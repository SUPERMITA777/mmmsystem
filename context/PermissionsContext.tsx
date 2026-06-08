"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useTenant } from "@/context/TenantContext";
import { useAuth } from "@/components/admin/AuthProvider";

/**
 * @typedef {string} PermissionLevel - "none" | "view" | "edit"
 */

/**
 * @typedef {Object} PermissionsContextType
 * @property {Record<string, Record<string, PermissionLevel>>} permisos - Mapa estructurado de permisos por rol y sección.
 * @property {boolean} loading - Indica si se están cargando los permisos desde la configuración de sucursal.
 * @property {function} canView - Retorna true si el usuario actual tiene permisos de visualización ("view" o "edit") para la sección especificada.
 * @property {function} canEdit - Retorna true si el usuario actual tiene permisos de edición/escritura ("edit") para la sección especificada.
 * @property {function} getPermissionLevel - Retorna el nivel de acceso directo ("none", "view", "edit") para la sección.
 */

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

/**
 * Hook para consumir las validaciones de permisos y control de acceso del panel.
 * 
 * @returns {PermissionsContextType} Las utilidades de chequeo de visualización y edición.
 */
export function usePermissions() {
    return useContext(PermissionsContext);
}

/**
 * Proveedor del sistema de autorización fina por roles.
 * Consulta la tabla `config_sucursal` y mapea los niveles de acceso dinámicos
 * para camareros, empleados, repartidores, etc. Los roles `admin` y `super_admin`
 * omiten estas restricciones por defecto.
 * 
 * @provider PermissionsProvider
 * @param {Object} props - Propiedades del componente.
 * @param {React.ReactNode} props.children - Nodos hijos a renderizar.
 */
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

    // Check if permissions have been explicitly configured for this role
    function hasConfiguredPermissions(rol: string): boolean {
        return !!permisos[rol] && Object.keys(permisos[rol]).length > 0;
    }

    function canView(sectionId: string): boolean {
        const rol = getUserRole();
        // Super admin and admin always have full access
        if (rol === "super_admin" || rol === "admin") return true;
        // While loading or if user not yet resolved, grant access to prevent empty sidebar
        if (loading || !user) return true;
        // If no permissions configured for this role, grant full access by default
        if (!hasConfiguredPermissions(rol)) return true;

        const level = permisos[rol]?.[sectionId];
        // If section not explicitly configured, grant access
        if (level === undefined) return true;
        return level === "view" || level === "edit";
    }

    function canEdit(sectionId: string): boolean {
        const rol = getUserRole();
        // Super admin and admin always have full access
        if (rol === "super_admin" || rol === "admin") return true;
        // While loading or if user not yet resolved, grant access
        if (loading || !user) return true;
        // If no permissions configured for this role, grant full access by default
        if (!hasConfiguredPermissions(rol)) return true;

        const level = permisos[rol]?.[sectionId];
        // If section not explicitly configured, grant edit access
        if (level === undefined) return true;
        return level === "edit";
    }

    function getPermissionLevel(sectionId: string): PermissionLevel {
        const rol = getUserRole();
        if (rol === "super_admin" || rol === "admin") return "edit";
        if (loading || !user) return "edit";
        if (!hasConfiguredPermissions(rol)) return "edit";

        return permisos[rol]?.[sectionId] || "edit";
    }

    return (
        <PermissionsContext.Provider value={{ permisos, loading, canView, canEdit, getPermissionLevel }}>
            {children}
        </PermissionsContext.Provider>
    );
}
