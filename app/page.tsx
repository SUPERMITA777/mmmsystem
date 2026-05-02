"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const tenant = localStorage.getItem("last_tenant") || "mmm";
        
        // Timeout para asegurar que Next.js haya hidratado el router
        setTimeout(() => {
            router.replace(`/${tenant}/admin/panel-pedidos`);
        }, 100);
    }, [router]);

    if (!mounted) return null;

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center animate-pulse">
                <div className="w-16 h-16 border-4 border-[#7B1FA2] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <h2 className="text-lg font-bold text-gray-700">MMM System</h2>
                <p className="text-sm text-gray-500">Iniciando entorno local...</p>
            </div>
        </div>
    );
}
