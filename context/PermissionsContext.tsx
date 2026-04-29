"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useTenant } from "@/context/TenantContext";
import { useAuth } from "@/components/admin/AuthProvider";

// Permission levels: "none" | "view" | "edit"
// - "none": No access at all (section hidden)
// - "view": Can see the section but cannot modify data (buttons disabled, forms read-only)
// - "edit": Full access to view and modify data

type PermissionLevel = "none" | "view" | "edit";
type PermissionsMap = Record<string, Record<string, PermissionLevel>>;

interface PermissionsContextType {
    permisos: PermissionsMap;
    loading: boolean;
    canView: (sectionId: string) => boolean;
    canEdit: (sectionId: string) => boolean;
    getPermissionLevel: (sectionId: string) => PermissionLevel;
}

const PermissionsContext = createContext<PermissionsContextType>({
    permisos: {},
    loading: true,
    canView: () => true,
    canEdit: () => true,
    getPermissionLevel: () => "edit",
});

export function usePermissions() {
    return useContext(PermissionsContext);
}

export function PermissionsProvider({ children }: { children: ReactNode }) {
    const { sucursalId } = useTenant();
    const { user } = useAuth();
    const [permisos, setPermisos] = useState<PermissionsMap>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (sucursalId) {
            loadPermisos();
        }
    }, [sucursalId]);

    async function loadPermisos() {
        try {
            const { data } = await supabase
                .from("config_sucursal")
                .select("permisos")
                .eq("sucursal_id", sucursalId)
                .maybeSingle();

            if (data?.permisos) {
                // Migrate old boolean format to new format if needed
                const migrated = migratePermissions(data.permisos);
                setPermisos(migrated);
            }
        } catch (error) {
            console.error("Error loading permisos:", error);
        } finally {
            setLoading(false);
        }
    }

    // Migrate old boolean format { role: { section: true/false } } 
    // to new format { role: { section: "none" | "view" | "edit" } }
    function migratePermissions(raw: any): PermissionsMap {
        const result: PermissionsMap = {};
        for (const rol of Object.keys(raw)) {
            result[rol] = {};
            for (const section of Object.keys(raw[rol])) {
                const val = raw[rol][section];
                if (typeof val === "boolean") {
                    // Old format: true -> "edit", false -> "none"
                    result[rol][section] = val ? "edit" : "none";
                } else if (val === "view" || val === "edit" || val === "none") {
                    result[rol][section] = val;
                } else {
                    result[rol][section] = "none";
                }
            }
        }
        return result;
    }

    function getUserRole(): string {
        return user?.rol || "empleado";
    }

    function canView(sectionId: string): boolean {
        const rol = getUserRole();
        // Super admin and admin always have full access
        if (rol === "super_admin" || rol === "admin") return true;

        const level = permisos[rol]?.[sectionId];
        return level === "view" || level === "edit";
    }

    function canEdit(sectionId: string): boolean {
        const rol = getUserRole();
        // Super admin and admin always have full access
        if (rol === "super_admin" || rol === "admin") return true;

        return permisos[rol]?.[sectionId] === "edit";
    }

    function getPermissionLevel(sectionId: string): PermissionLevel {
        const rol = getUserRole();
        if (rol === "super_admin" || rol === "admin") return "edit";

        return permisos[rol]?.[sectionId] || "none";
    }

    return (
        <PermissionsContext.Provider value={{ permisos, loading, canView, canEdit, getPermissionLevel }}>
            {children}
        </PermissionsContext.Provider>
    );
}
