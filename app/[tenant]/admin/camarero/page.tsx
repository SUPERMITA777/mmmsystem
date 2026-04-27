"use client";

import { MapaSalon } from "@/components/salon/MapaSalon";
import { AdminSectionShell } from "@/components/admin/AdminSectionShell";

export default function CamareroPage() {
    return (
        <AdminSectionShell
            title="Panel de Camarero"
            subtitle="Atención de mesas en salón"
        >
            <div className="flex-1 min-h-[calc(100vh-180px)]">
                <MapaSalon isCamareroMode={true} />
            </div>
        </AdminSectionShell>
    );
}
