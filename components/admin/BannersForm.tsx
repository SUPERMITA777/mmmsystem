'use client';

import { useState } from 'react';
import { createBanner } from '@/app/[tenant]/admin/mundial/banners/actions';

export default function BannersForm({ sucursalId, tenant }: { sucursalId: string, tenant: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; error?: string } | null>(null);

  async function action(formData: FormData) {
    setLoading(true);
    setResult(null);
    formData.append('sucursal_id', sucursalId);
    formData.append('tenant', tenant);
    
    const res = await createBanner(formData);
    setResult(res);
    setLoading(false);

    if (res.success) {
      // Form fields can be cleared via reset logic if we used a ref, but simple state is fine
      window.location.reload();
    }
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Agregar Nuevo Banner</h3>
      
      <form action={action} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Anunciante</label>
          <input 
            type="text" 
            name="nombre_anunciante" 
            required 
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Ej: Nike"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Imagen del Banner</label>
          <input 
            type="file" 
            name="imagen_file" 
            accept="image/*"
            required 
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <p className="text-xs text-gray-500 mt-1">Sube la imagen directamente desde tu dispositivo.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Link de Destino (Opcional)</label>
          <input 
            type="url" 
            name="link_destino" 
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="https://nike.com"
          />
        </div>

        {result?.error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">
            {result.error}
          </div>
        )}

        <button 
          type="submit" 
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md shadow-sm transition-colors disabled:opacity-50"
        >
          {loading ? 'Guardando...' : 'Guardar Banner'}
        </button>
      </form>
    </div>
  );
}
