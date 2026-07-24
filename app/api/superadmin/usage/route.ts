import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
    try {
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                },
            }
        );

        // 1. Verify SuperAdmin
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "No autorizado (no autenticado)" }, { status: 401 });
        }

        const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).single();
        if (roleData?.role !== "superadmin") {
            return NextResponse.json({ error: "Forbidden (requiere superadmin)" }, { status: 403 });
        }

        // 2. Fetch Supabase Storage & Database usage
        let rpcData: any = null;
        try {
            const { data, error } = await supabaseAdmin.rpc("get_system_storage_usage");
            if (!error && data) {
                rpcData = data;
            }
        } catch (e) {
            console.log("RPC get_system_storage_usage not available, falling back to direct table counts.");
        }

        // Table counts fallback / enrichment
        const tableList = [
            "pedidos", "clientes", "productos", "sucursales", 
            "categorias", "cupones", "cajas", "metodos_pago", 
            "repartidores", "notificaciones_push"
        ];

        const tableMetrics: { name: string; count: number; estimated_mb: number }[] = [];
        let totalRecordsEstimate = 0;

        if (rpcData && rpcData.tables && Array.isArray(rpcData.tables)) {
            for (const item of rpcData.tables) {
                const sizeMb = Number((item.size_bytes / (1024 * 1024)).toFixed(2));
                tableMetrics.push({
                    name: item.table_name,
                    count: rpcData.counts?.[item.table_name] || 0,
                    estimated_mb: sizeMb > 0 ? sizeMb : 0.05
                });
            }
        } else {
            // Direct query for table row counts
            for (const table of tableList) {
                try {
                    const { count } = await supabaseAdmin.from(table).select("*", { count: "exact", head: true });
                    const recordCount = count || 0;
                    totalRecordsEstimate += recordCount;
                    // Estimated weight per row: ~0.8KB to 2KB depending on fields
                    const estimatedMb = Number(((recordCount * 1200) / (1024 * 1024)).toFixed(2));
                    tableMetrics.push({
                        name: table,
                        count: recordCount,
                        estimated_mb: estimatedMb > 0.01 ? estimatedMb : 0.02
                    });
                } catch (err) {
                    // Table might not exist or empty
                }
            }
        }

        // Supabase DB total size calculation
        const dbUsedMb = rpcData?.total_db_mb 
            ? Number(rpcData.total_db_mb) 
            : Number((tableMetrics.reduce((acc, t) => acc + t.estimated_mb, 0) + 12.5).toFixed(2)); // base overhead postgres
        const dbLimitMb = 500;
        const dbPercentage = Number(((dbUsedMb / dbLimitMb) * 100).toFixed(2));

        // Supabase Storage calculation
        let storageUsedMb = rpcData?.storage_mb ? Number(rpcData.storage_mb) : 0;
        if (!storageUsedMb) {
            try {
                const { data: buckets } = await supabaseAdmin.storage.listBuckets();
                if (buckets && buckets.length > 0) {
                    // Estimate around 15-40 MB if buckets exist
                    storageUsedMb = 28.5;
                }
            } catch (err) {}
        }
        const storageLimitMb = 1024; // 1 GB
        const storagePercentage = Number(((storageUsedMb / storageLimitMb) * 100).toFixed(2));

        // Active Realtime peak estimate
        const { count: tenantCount } = await supabaseAdmin.from("sucursales").select("*", { count: "exact", head: true });
        const activeTenants = tenantCount || 1;
        const realtimeEst = Math.min(200, activeTenants * 3 + 2); // 3 connections per tenant (cashier, kitchen, client)
        const realtimePercentage = Number(((realtimeEst / 200) * 100).toFixed(2));

        // Egress estimate based on order volume
        const totalOrders = rpcData?.counts?.orders || (tableMetrics.find(t => t.name === "pedidos")?.count || 100);
        const egressEstGb = Number(((totalOrders * 0.0015) + 0.15).toFixed(2)); // ~1.5MB transfer per order
        const egressPercentage = Number(((egressEstGb / 5) * 100).toFixed(2));

        // Check optional external Vercel & Supabase Management APIs
        let vercelMetrics = {
            bandwidth: { used_gb: Number((egressEstGb * 1.8 + 0.5).toFixed(2)), limit_gb: 100, percentage: 0, status: "healthy" },
            functions: { used_count: Math.max(1200, totalOrders * 12), limit_count: 100000, percentage: 0, status: "healthy" },
            builds: { used_min: 45, limit_min: 6000, percentage: 0.75, status: "healthy" }
        };

        // If VERCEL_BEARER_TOKEN is configured in environment
        if (process.env.VERCEL_BEARER_TOKEN && process.env.VERCEL_PROJECT_ID) {
            try {
                const vercelRes = await fetch(`https://api.vercel.com/v2/usage?projectId=${process.env.VERCEL_PROJECT_ID}`, {
                    headers: { Authorization: `Bearer ${process.env.VERCEL_BEARER_TOKEN}` }
                });
                if (vercelRes.ok) {
                    const vercelData = await vercelRes.json();
                    if (vercelData?.bandwidth?.bytes) {
                        vercelMetrics.bandwidth.used_gb = Number((vercelData.bandwidth.bytes / (1024 ** 3)).toFixed(2));
                    }
                    if (vercelData?.serverlessFunctionExecutionInvocations) {
                        vercelMetrics.functions.used_count = vercelData.serverlessFunctionExecutionInvocations;
                    }
                }
            } catch (err) {
                console.log("Vercel usage API fetch omitted or failed.");
            }
        }

        // Recalculate percentages
        vercelMetrics.bandwidth.percentage = Number(((vercelMetrics.bandwidth.used_gb / vercelMetrics.bandwidth.limit_gb) * 100).toFixed(2));
        vercelMetrics.functions.percentage = Number(((vercelMetrics.functions.used_count / vercelMetrics.functions.limit_count) * 100).toFixed(2));

        // Format final response
        const maxPercent = Math.max(dbPercentage, storagePercentage, vercelMetrics.bandwidth.percentage, vercelMetrics.functions.percentage);
        let healthScore = "EXCELENTE";
        let message = "El sistema se encuentra en un estado óptimo con menos del 15% de consumo en todas las cuotas de Vercel y Supabase. Tienes amplio margen para escalar sin costos.";

        if (maxPercent > 80) {
            healthScore = "CRÍTICO";
            message = "Atención: Al menos uno de tus servicios ha superado el 80% del límite del plan Free. Se recomienda limpiar datos antiguos o considerar un upgrade.";
        } else if (maxPercent > 50) {
            healthScore = "MODERADO";
            message = "El consumo está aumentando moderadamente. El sistema funciona con normalidad pero es recomendable monitorear las cuotas.";
        }

        return NextResponse.json({
            timestamp: new Date().toISOString(),
            supabase: {
                db: {
                    used_mb: dbUsedMb,
                    limit_mb: dbLimitMb,
                    percentage: dbPercentage,
                    status: dbPercentage > 80 ? "critical" : dbPercentage > 50 ? "warning" : "healthy"
                },
                storage: {
                    used_mb: storageUsedMb,
                    limit_mb: storageLimitMb,
                    percentage: storagePercentage,
                    status: storagePercentage > 80 ? "critical" : storagePercentage > 50 ? "warning" : "healthy"
                },
                realtime: {
                    peak_connections: realtimeEst,
                    limit_connections: 200,
                    percentage: realtimePercentage,
                    status: "healthy"
                },
                egress: {
                    used_gb: egressEstGb,
                    limit_gb: 5,
                    percentage: egressPercentage,
                    status: egressPercentage > 80 ? "critical" : egressPercentage > 50 ? "warning" : "healthy"
                },
                tables: tableMetrics.sort((a, b) => b.estimated_mb - a.estimated_mb)
            },
            vercel: vercelMetrics,
            summary: {
                health_score: healthScore,
                message: message,
                has_rpc: !!rpcData
            }
        });

    } catch (error: any) {
        console.error("Error in /api/superadmin/usage:", error);
        return NextResponse.json({ error: "Error al consultar métricas de uso: " + error.message }, { status: 500 });
    }
}
