"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter, usePathname, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

interface AuthUser {
    id: string;
    email: string;
    rol?: string;
    sucursal_id?: string | null;
}

interface AuthContextType {
    user: AuthUser | null;
    loading: boolean;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    logout: async () => { },
});

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const params = useParams();
    const tenant = params?.tenant || pathname.split('/')[1] || "demo";
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check if user is authenticated by calling a status endpoint
        // Since middleware already protects routes, if we reach here, user is authenticated
        // We can get user info from a simple check
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            // Check client-side session first
            const { data: { session } } = await supabase.auth.getSession();
            console.log("[AuthProvider] Client session:", session ? "Found" : "Not found");

            const res = await fetch("/api/auth/me");
            if (res.ok) {
                const data = await res.json();
                const authUser = data.user as AuthUser;
                setUser(authUser);

                // Sincronizar sesión con el cliente de Supabase si es necesario
                if (data.session) {
                    const { data: { session: currentSession } } = await supabase.auth.getSession();
                    if (!currentSession) {
                        console.log("[AuthProvider] Recovering session from server...");
                        await supabase.auth.setSession(data.session);
                    }
                }

                // Tenant Verification (client-side safety net — middleware handles the primary check)
                if (pathname.includes("/admin") && !pathname.includes("/admin/login") && authUser) {
                    // Skip check for super_admin — they can access any tenant
                    if (authUser.rol === "super_admin") return;

                    if (authUser.sucursal_id && tenant !== "superadmin") {
                        const { data: sucData } = await supabase
                            .from("sucursales")
                            .select("slug")
                            .eq("id", authUser.sucursal_id)
                            .single();
                        
                        if (sucData && sucData.slug !== tenant) {
                            // Preserve current admin sub-path (e.g., /admin/menu → /donjuan/admin/menu)
                            const adminIndex = pathname.indexOf("/admin");
                            const subPath = adminIndex !== -1 ? pathname.substring(adminIndex) : "/admin";
                            console.warn(`[Auth] Tenant mismatch: user belongs to "${sucData.slug}", redirecting from "${tenant}"`);
                            router.push(`/${sucData.slug}${subPath}`);
                            return;
                        }
                    }
                }
            }
        } catch (err) {
            console.error("Auth check error:", err);
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        try {
            await fetch("/api/auth/logout", { method: "POST" });
            setUser(null);
            router.push(`/${tenant}/admin/login`);
            router.refresh();
        } catch (err) {
            console.error("Error al cerrar sesión:", err);
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, logout }}>
            {children}
        </AuthContext.Provider>
    );
}
