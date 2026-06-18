'use client';

import { useState } from 'react';
import { upsertPremio } from '@/app/[tenant]/admin/mundial/premios/actions';

export default function PremiosForm({ partidos, sucursalId, tenant }: { partidos: any[], sucursalId: string, tenant: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; error?: string } | null>(null);

  async function action(formData: FormData) {
    setLoading(true);
    setResult(null);
    formData.append('sucursal_id', sucursalId);
    formData.append('tenant', tenant);
    
    const res = await upsertPremio(formData);
    setResult(res);
    setLoading(false);

    if (res.success) {
      window.location.reload();
    }
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Configurar Premio por Partido</h3>
      
      <form action={action} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Seleccionar Partido</label>
          <select 
            name="partido_id" 
            required 
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">-- Elija un partido --</option>
            {partidos.map(p => {
              const fechaStr = p.fecha_hora ? p.fecha_hora.split('T')[0] : '';
              return (
                <option key={p.id} value={p.id}>
                  {p.equipo_local} vs {p.equipo_visitante} - {fechaStr}
                </option>
              );
            })}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Premio</label>
          <input 
            type="text" 
            name="nombre" 
            required 
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Ej: Camiseta Oficial"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (Opcional)</label>
          <textarea 
            name="descripcion" 
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Ej: Talle L, se retira por caja central"
            rows={2}
          ></textarea>
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
          {loading ? 'Guardando...' : 'Guardar Premio'}
        </button>
      </form>
    </div>
  );
}
