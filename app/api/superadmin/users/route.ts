import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function verifySuperAdmin(request?: Request) {
    // Strategy 1: Bearer token from Authorization header
    let token: string | null = null;
    if (request) {
        const authHeader = request.headers.get("Authorization");
        if (authHeader?.startsWith("Bearer ")) {
            token = authHeader.slice(7);
        }
    }

    if (!token) {
        console.error("verifySuperAdmin: No token provided");
        return null;
    }

    // Verify the token using supabaseAdmin (service role) 
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
        console.error("verifySuperAdmin: user error:", userError?.message);
        return null;
    }

    // Check role using supabaseAdmin (bypasses any RLS)
    const { data: roleData, error: roleError } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

    if (roleError) {
        console.error("verifySuperAdmin: roleError:", roleError.message);
        return null;
    }
    if (roleData?.role !== "superadmin") {
        console.error("verifySuperAdmin: user is not superadmin, role:", roleData?.role);
        return null;
    }

    return user;
}

export async function GET(request: Request) {
    try {
        const superAdmin = await verifySuperAdmin(request);
        if (!superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // 1. Get all auth users using Admin API
        const { data: authUsers, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
        if (usersError) {
            console.error('SuperAdmin Users Error:', usersError);
            return NextResponse.json({ error: `Auth Admin Error: ${usersError.message}` }, { status: 400 });
        }

        // 2. Get all roles and sucursales info
        const { data: roles } = await supabaseAdmin.from("user_roles").select("*");
        const { data: sucursales } = await supabaseAdmin.from("sucursales").select("id, nombre, slug");

        // 3. Merge data
        const mergedUsers = authUsers.users.map(u => {
            const roleInfo = roles?.find(r => r.user_id === u.id);
            const sucursalInfo = roleInfo?.sucursal_id ? sucursales?.find(s => s.id === roleInfo.sucursal_id) : null;
            return {
                id: u.id,
                email: u.email,
                created_at: u.created_at,
                role: roleInfo?.role || "user",
                sucursal_id: roleInfo?.sucursal_id || null,
                sucursal_nombre: sucursalInfo?.nombre || null,
                sucursal_slug: sucursalInfo?.slug || null,
            };
        });

        // Sort by creation date descending
        mergedUsers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return NextResponse.json({ users: mergedUsers });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const superAdmin = await verifySuperAdmin(request);
        if (!superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await request.json();
        const { email, password, role, sucursal_id } = body;

        if (!email || !password || !role) {
            return NextResponse.json({ error: "Faltan datos requeridos (email, password, role)" }, { status: 400 });
        }

        // Create Auth User
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { role }
        });

        if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

        // Map Role
        await supabaseAdmin.from("user_roles").insert({
            user_id: authData.user.id,
            role: role,
            sucursal_id: sucursal_id || null
        });

        return NextResponse.json({ success: true, message: "Usuario creado correctamente" });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const superAdmin = await verifySuperAdmin(request);
        if (!superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await request.json();
        const { user_id, password, role, sucursal_id, email } = body;

        if (!user_id) return NextResponse.json({ error: "user_id es requerido" }, { status: 400 });

        // Update auth details (email/password) if provided
        const updatePayload: any = {};
        if (password) updatePayload.password = password;
        if (email) {
            updatePayload.email = email;
            updatePayload.email_confirm = true; // Auto-confirm email change
        }

        if (Object.keys(updatePayload).length > 0) {
            const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user_id, updatePayload);
            if (authError) return NextResponse.json({ error: "Error actualizando auth: " + authError.message }, { status: 400 });
        }

        // Upsert user role and sucursal mapped link
        if (role) {
            const valObj: any = { user_id, role };
            if (sucursal_id) valObj.sucursal_id = sucursal_id;
            else valObj.sucursal_id = null; // removing tenant link if empty

            // Safely update or insert without relying on onConflict constraints
            const { data, error: updateError } = await supabaseAdmin
                .from("user_roles")
                .update({ role: valObj.role, sucursal_id: valObj.sucursal_id })
                .eq("user_id", user_id)
                .select();

            if (updateError) {
                return NextResponse.json({ error: "Error actualizando rol: " + updateError.message }, { status: 400 });
            }

            // If no existing record was found for this user, insert a new one
            if (!data || data.length === 0) {
                const { error: insertError } = await supabaseAdmin
                    .from("user_roles")
                    .insert(valObj);
                
                if (insertError) {
                    return NextResponse.json({ error: "Error insertando rol: " + insertError.message }, { status: 400 });
                }
            }
        }

        return NextResponse.json({ success: true, message: "Usuario actualizado correctamente" });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
