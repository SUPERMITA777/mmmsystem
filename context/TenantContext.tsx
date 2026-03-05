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

    return (
        <TenantContext.Provider value={{ tenantSlug, sucursalId, sucursalData, loading }}>
            {children}
        </TenantContext.Provider>
    );
}
