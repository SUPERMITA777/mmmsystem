'use client';

import { useState } from 'react';
import { upsertPremio } from '@/app/[tenant]/admin/mundial/premios/actions';

export default function PremioInlineForm({ partidoId, sucursalId, tenant, initialPremio }: { partidoId: string, sucursalId: string, tenant: string, initialPremio?: any }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; error?: string } | null>(null);

  async function action(formData: FormData) {
    setLoading(true);
    setResult(null);
    formData.append('sucursal_id', sucursalId);
    formData.append('tenant', tenant);
    formData.append('partido_id', partidoId);
    
    const res = await upsertPremio(formData);
    setResult(res);
    setLoading(false);
  }

  return (
    <form action={action} className="space-y-3">
      <div>
        <input 
          type="text" 
          name="nombre" 
          required 
          defaultValue={initialPremio?.nombre || ''}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
          placeholder="Ej: Camiseta Oficial"
        />
      </div>

      <div>
        <textarea 
          name="descripcion" 
          defaultValue={initialPremio?.descripcion || ''}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
          placeholder="Descripción (Opcional)"
          rows={2}
        ></textarea>
      </div>

      {result && (
        <div className={`p-2 rounded text-xs ${result.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {result.success ? 'Guardado ✅' : result.error}
        </div>
      )}

      <button 
        type="submit" 
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-3 rounded text-sm transition-colors disabled:opacity-50"
      >
        {loading ? 'Guardando...' : (initialPremio ? 'Actualizar Premio' : 'Asignar Premio')}
      </button>
    </form>
  );
}
