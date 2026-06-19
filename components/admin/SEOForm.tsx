'use client';

import { useState } from 'react';
import { updateSEO } from '@/app/[tenant]/admin/mundial/ajustes/actions';

export default function SEOForm({ 
  sucursalId, 
  tenant,
  defaultTitle,
  defaultDesc
}: { 
  sucursalId: string, 
  tenant: string,
  defaultTitle: string,
  defaultDesc: string
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; error?: string } | null>(null);

  async function action(formData: FormData) {
    setLoading(true);
    setResult(null);
    formData.append('sucursal_id', sucursalId);
    formData.append('tenant', tenant);
    
    const res = await updateSEO(formData);
    setResult(res);
    setLoading(false);
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Textos para Redes Sociales (WhatsApp, Facebook, etc)</h3>
      <p className="text-sm text-gray-500 mb-6">Define qué texto aparecerá cuando compartas el link del mundial a tus clientes.</p>
      
      <form action={action} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Título principal</label>
          <input 
            type="text" 
            name="mundial_og_title" 
            defaultValue={defaultTitle}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Ej: ¡Jugá al Prode de MiPizzeria!"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripción corta</label>
          <textarea 
            name="mundial_og_description" 
            defaultValue={defaultDesc}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Ej: Adiviná los resultados, suma puntos y gana premios increíbles cada partido."
            rows={3}
          ></textarea>
        </div>

        {result && (
          <div className={`p-3 rounded-md text-sm ${result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {result.success ? '¡Configuración guardada correctamente!' : result.error}
          </div>
        )}

        <button 
          type="submit" 
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md shadow-sm transition-colors disabled:opacity-50"
        >
          {loading ? 'Guardando...' : 'Guardar Ajustes'}
        </button>
      </form>
    </div>
  );
}
