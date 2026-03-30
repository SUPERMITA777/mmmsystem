"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

interface TenantContextType {
    tenantSlug: string;
    sucursalId: string | null;
    sucursalData: any | null;
    loading: boolean;
}

const TenantContext = createContext<TenantContextType>({
    tenantSlug: "",
    sucursalId: null,
    sucursalData: null,
    loading: true,
});

export function useTenant() {
    return useContext(TenantContext);
}

export function TenantProvider({ children }: { children: ReactNode }) {
    const params = useParams();
    const pathname = usePathname();
    const router = useRouter();

    const tenantSlug = (params?.tenant as string) || pathname.split('/')[1] || "demo";

    const [sucursalId, setSucursalId] = useState<string | null>(null);
    const [sucursalData, setSucursalData] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

    const [isExpired, setIsExpired] = useState(false);

    useEffect(() => {
        if (!tenantSlug) {
            setLoading(false);
            return;
        }

        async function fetchTenant() {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from("sucursales")
                    .select("*")
                    .eq("slug", tenantSlug)
                    .eq("activo", true)
                    .single();

                if (error || !data) {
                    console.error("Tenant no encontrado:", tenantSlug);
                    router.push("/superadmin"); // Redirect if invalid tenant
                    return;
                }

                if (data.subscription_end && new Date(data.subscription_end) < new Date()) {
                    setIsExpired(true);
                }

                setSucursalId(data.id);
                setSucursalData(data);
            } catch (err) {
                console.error("Error fetching tenant", err);
            } finally {
                setLoading(false);
            }
        }

        fetchTenant();
    }, [tenantSlug, router]);

    if (isExpired) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-center">
                <div className="bg-slate-800 p-8 rounded-2xl border border-rose-500/20 shadow-2xl max-w-md w-full">
                    <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Servicio Suspendido</h1>
                    <p className="text-slate-300 text-sm mb-6">
                        La suscripción de este comercio ha vencido. Si eres el administrador, por favor contacta a soporte para renovar tu plan.
                    </p>
                    <a href="https://wa.me/5491112345678" target="_blank" rel="noreferrer" className="inline-block bg-white text-slate-900 font-bold px-6 py-3 rounded-lg hover:bg-slate-100 transition-colors">
                        Contactar Soporte
                    </a>
                </div>
            </div>
        );
    }

    return (
        <TenantContext.Provider value={{ tenantSlug, sucursalId, sucursalData, loading }}>
            {children}
        </TenantContext.Provider>
    );
}
