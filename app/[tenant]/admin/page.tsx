"use client";

import { AdminSectionShell } from "@/components/admin/AdminSectionShell";
import { useAuth } from "@/components/admin/AuthProvider";
import { useRouter, useParams } from "next/navigation";
import { useEffect } from "react";

export default function AdminHomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    if (!loading && user?.rol === "camarero") {
      const tenant = params?.tenant || "mmm";
      router.replace(`/${tenant}/admin/camarero`);
    }
  }, [user, loading, router, params]);

  if (loading || user?.rol === "camarero") return null;

  return (
    <AdminSectionShell
      title="Dashboard"
      subtitle="Resumen general de tu negocio."
    />
  );
}

