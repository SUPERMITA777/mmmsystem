"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

/**
 * @typedef {Object} AdminUIContextType
 * @property {boolean} isSidebarCollapsed - Indica si la barra lateral está colapsada en vistas de escritorio.
 * @property {function} toggleSidebar - Alterna el colapso de la barra lateral de escritorio.
 * @property {boolean} isMobileSidebarOpen - Indica si el menú lateral de móvil está abierto.
 * @property {function} toggleMobileSidebar - Alterna la apertura de la barra lateral móvil.
 * @property {function} closeMobileSidebar - Cierra la barra lateral móvil.
 */

type AdminUIContextType = {
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  isMobileSidebarOpen: boolean;
  toggleMobileSidebar: () => void;
  closeMobileSidebar: () => void;
};

const AdminUIContext = createContext<AdminUIContextType | undefined>(undefined);

/**
 * Proveedor del contexto de la interfaz de administración (Admin UI).
 * Maneja el estado responsivo de colapso y visibilidad de los paneles laterales.
 * 
 * @provider AdminUIProvider
 * @param {Object} props - Propiedades del componente.
 * @param {React.ReactNode} props.children - Nodos hijos a renderizar.
 */
export function AdminUIProvider({ children }: { children: React.ReactNode }) {

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Auto-collapse sidebar on smaller desktop screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && window.innerWidth < 1200) {
        setIsSidebarCollapsed(true);
      } else if (window.innerWidth >= 1200) {
        setIsSidebarCollapsed(false);
      }
      
      if (window.innerWidth >= 1024) {
        setIsMobileSidebarOpen(false);
      }
    };

    handleResize(); // Initial check
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleSidebar = () => setIsSidebarCollapsed((prev) => !prev);
  const toggleMobileSidebar = () => setIsMobileSidebarOpen((prev) => !prev);
  const closeMobileSidebar = () => setIsMobileSidebarOpen(false);

  return (
    <AdminUIContext.Provider
      value={{
        isSidebarCollapsed,
        toggleSidebar,
        isMobileSidebarOpen,
        toggleMobileSidebar,
        closeMobileSidebar,
      }}
    >
      {children}
    </AdminUIContext.Provider>
  );
}

/**
 * Hook para consumir los estados de la interfaz de administración (Admin UI).
 * Debe utilizarse dentro de un AdminUIProvider.
 * 
 * @returns {AdminUIContextType} El contexto de estados e interactividad lateral.
 * @throws {Error} Si se utiliza fuera de un AdminUIProvider.
 */
export function useAdminUI() {
  const context = useContext(AdminUIContext);
  if (context === undefined) {
    throw new Error("useAdminUI must be used within an AdminUIProvider");
  }
  return context;
}

