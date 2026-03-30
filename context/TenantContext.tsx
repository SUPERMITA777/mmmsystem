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
            <div className="min-h-screen bg-[#060e20] flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#00B2FF]/10 rounded-full blur-[120px]" />
                
                <div className="bg-white/5 backdrop-blur-2xl p-12 rounded-[3rem] border border-white/10 shadow-2xl max-w-md w-full relative z-10 animate-in zoom-in-95 duration-500">
                    <div className="w-24 h-24 bg-[#00B2FF]/10 text-[#00B2FF] rounded-[2rem] flex items-center justify-center mx-auto mb-8 border border-[#00B2FF]/20 shadow-[0_0_40px_rgba(0,178,255,0.2)]">
                        <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-black text-white mb-4 tracking-tight uppercase italic">Servicio Pausado</h1>
                    <p className="text-slate-400 text-sm mb-10 leading-relaxed font-medium">
                        La suscripción de este comercio ha llegado a su fin. 
                        Si eres el titular, contacta a soporte para reactivar tu vidriera digital.
                    </p>
                    <a href="https://wa.me/5491112345678" target="_blank" rel="noreferrer" className="block w-full bg-[#00B2FF] hover:bg-[#0092d1] text-white font-black px-8 py-5 rounded-2xl transition-all shadow-[0_10px_30px_rgba(0,178,255,0.3)] uppercase tracking-widest text-xs active:scale-95">
                        Consultar Reactivación
                    </a>
                </div>
                
                <p className="mt-12 text-[10px] text-slate-600 font-bold tracking-[0.3em] uppercase opacity-50 relative z-10">
                    MMM SYSTEM INFRASTRUCTURE
                </p>
            </div>
        );
    }

    return (
        <TenantContext.Provider value={{ tenantSlug, sucursalId, sucursalData, loading }}>
            {children}
        </TenantContext.Provider>
    );
}
