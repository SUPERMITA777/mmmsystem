/**
 * serverAuth.ts
 *
 * Verificación server-side de sesión y aislamiento multi-tenant (`sucursal_id`)
 * para los endpoints del Copiloto IA.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export interface AuthenticatedAdmin {
    id: string;
    email: string;
    rol: string;
    sucursal_id: string | null;
    nombre: string | null;
}

export type SessionCheckResult =
    | { ok: true; user: AuthenticatedAdmin }
    | { ok: false; status: number; error: string };

export async function verifyTenantSession(
    sucursalId: string,
    options: { requireWrite?: boolean } = {}
): Promise<SessionCheckResult> {
    if (!sucursalId) {
        return { ok: false, status: 400, error: "sucursalId es requerido" };
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, opts: any) {
                    try {
                        cookieStore.set({ name, value, ...opts });
                    } catch {
                        // Ignore cookie mutation in read-only contexts
                    }
                },
                remove(name: string, opts: any) {
                    try {
                        cookieStore.delete({ name, ...opts });
                    } catch {
                        // Ignore cookie mutation in read-only contexts
                    }
                },
            },
        }
    );

    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error || !user) {
        return { ok: false, status: 401, error: "Sesión no autenticada" };
    }

    let rol = "empleado";
    let userSucursalId: string | null = null;
    let nombre: string | null = null;

    const { data: userData } = await supabaseAdmin
        .from("usuarios")
        .select("rol, sucursal_id, nombre, activo")
        .eq("id", user.id)
        .maybeSingle();

    if (userData) {
        if (userData.activo === false) {
            return { ok: false, status: 403, error: "Usuario desactivado" };
        }
        rol = userData.rol || rol;
        userSucursalId = userData.sucursal_id || null;
        nombre = userData.nombre || null;
    }

    if (rol === "empleado") {
        const { data: roleData } = await supabaseAdmin
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .maybeSingle();

        if (roleData?.role) {
            rol = roleData.role === "superadmin" ? "super_admin" : roleData.role;
        }
    }

    if (!userSucursalId && rol !== "super_admin") {
        const { data: ownerSuc } = await supabaseAdmin
            .from("sucursales")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (ownerSuc?.id) {
            userSucursalId = ownerSuc.id;
            if (rol === "empleado") {
                rol = "admin";
            }
        }
    }

    // Aislamiento estricto multi-tenant
    if (rol !== "super_admin" && userSucursalId !== sucursalId) {
        return {
            ok: false,
            status: 403,
            error: "No tenés acceso a los datos de esta sucursal",
        };
    }

    const isPrivileged = rol === "super_admin" || rol === "admin" || rol === "administrador";

    if (options.requireWrite && !isPrivileged) {
        // Verificar permisos explícitos configurados en config_sucursal
        const { data: cfg } = await supabaseAdmin
            .from("config_sucursal")
            .select("permisos")
            .eq("sucursal_id", sucursalId)
            .maybeSingle();

        const rolePerms = cfg?.permisos?.[rol];
        if (rolePerms && typeof rolePerms === "object") {
            const assistantLevel = rolePerms["asistente-ia"];
            const menuLevel = rolePerms["menu"];
            if (assistantLevel === "none" || assistantLevel === "view" || menuLevel === "none" || menuLevel === "view") {
                return {
                    ok: false,
                    status: 403,
                    error: "Tu rol no tiene permisos de edición para aplicar cambios",
                };
            }
        } else {
            return {
                ok: false,
                status: 403,
                error: "Solo administradores o roles habilitados pueden confirmar cambios",
            };
        }
    }

    return {
        ok: true,
        user: {
            id: user.id,
            email: user.email || "",
            rol,
            sucursal_id: userSucursalId,
            nombre,
        },
    };
}
