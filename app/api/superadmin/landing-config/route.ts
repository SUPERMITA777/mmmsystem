import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import fs from "fs";
import path from "path";

const configFilePath = path.join(process.cwd(), "lib", "landing_config.json");

// Helper to safely read JSON with robust fallbacks
function readConfig() {
    try {
        if (fs.existsSync(configFilePath)) {
            const content = fs.readFileSync(configFilePath, "utf8");
            return JSON.parse(content);
        }
    } catch (e) {
        console.error("Error reading landing config file:", e);
    }
    // Fallback in case of any issues
    return {
        phone: "+54 9 11 1234-5678",
        whatsapp: "5491112345678",
        email: "contacto@mmmsystem.com",
        title: "MMM System",
        subtitle: "El ecosistema definitivo para la gestión integral y automatizada de tu restaurante.",
        heroTitle: "Revoluciona la Gestión de tu Restaurante",
        heroSubtitle: "Control centralizado de pedidos, salón interactivo, delivery sincronizado y un asistente de Inteligencia Artificial las 24 horas.",
        aboutTitle: "Diseñado por Gastronómicos, para Gastronómicos",
        aboutText: "MMM System nace para dar respuesta a la necesidad de un control absoluto, rápido y sin fricciones.",
        features: [],
        pricingTitle: "Planes a la Medida de tu Negocio",
        pricingSubtitle: "Escalabilidad asegurada con licencias flexibles.",
        plans: []
    };
}

// Verification function for SuperAdmin writing operations
async function verifySuperAdmin(request: Request) {
    try {
        let token: string | null = null;
        const authHeader = request.headers.get("Authorization");
        if (authHeader?.startsWith("Bearer ")) {
            token = authHeader.slice(7);
        }

        if (!token) return null;

        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
        if (userError || !user) return null;

        const { data: roleData } = await supabaseAdmin
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .single();

        if (roleData?.role !== "superadmin") return null;
        return user;
    } catch (e) {
        console.error("verifySuperAdmin error:", e);
        return null;
    }
}

export async function GET() {
    try {
        const config = readConfig();
        return NextResponse.json(config);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const superAdmin = await verifySuperAdmin(request);
        if (!superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await request.json();
        
        // Write back to JSON file persistently
        fs.writeFileSync(configFilePath, JSON.stringify(body, null, 2), "utf8");

        return NextResponse.json({ success: true, config: body });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
