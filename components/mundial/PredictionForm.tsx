'use client';

import { useState } from 'react';
import { submitPrediction } from '@/app/[tenant]/mundial/actions';

export default function PredictionForm({ partido, sucursalId }: { partido: any, sucursalId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const formData = new FormData(e.currentTarget);
    formData.append('sucursal_id', sucursalId);
    
    // El tenant ya no es necesario aquí si resolvemos desde params/cookies en actions o lo pasamos explícito
    // Pero lo pasaremos por si el action lo usa para revalidatePath
    const urlParts = window.location.pathname.split('/');
    const tenant = urlParts[1];
    formData.append('tenant', tenant);

    const res = await submitPrediction(formData);
    setResult(res);
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <input type="hidden" name="partido_id" value={partido.id} />
      
      <div className="flex gap-4 justify-center items-center">
        <div className="w-20">
          <input 
            type="number" 
            name="prediccion_local" 
            min="0" max="20" required 
            placeholder="0"
            className="w-full text-center text-3xl font-black bg-white/10 text-white placeholder-white/20 border-2 border-white/10 rounded-2xl py-3 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all"
          />
        </div>
        <div className="text-gray-500 font-bold">-</div>
        <div className="w-20">
          <input 
            type="number" 
            name="prediccion_visitante" 
            min="0" max="20" required 
            placeholder="0"
            className="w-full text-center text-3xl font-black bg-white/10 text-white placeholder-white/20 border-2 border-white/10 rounded-2xl py-3 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all"
          />
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t border-white/10 mt-6">
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tu Nombre y Apellido</label>
          <input 
            type="text" 
            name="nombre_cliente" 
            required 
            placeholder="Juan Pérez"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-green-500 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Número de WhatsApp</label>
          <input 
            type="tel" 
            name="whatsapp" 
            required 
            placeholder="Ej: 5491123456789"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-green-500 transition-colors"
          />
          <p className="text-[10px] text-gray-500 mt-1.5 font-medium">Incluye el código de país (Ej: 54 para Argentina)</p>
        </div>
      </div>

      {result && (
        <div className={`p-4 rounded-xl text-sm font-bold shadow-lg ${result.success ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
          {result.success ? (
            <div>
              <p className="flex items-center gap-2 mb-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                ¡Predicción guardada!
              </p>
              <p className="font-normal text-xs opacity-90 mt-2">Tu código: <span className="font-mono text-white text-base bg-black/30 px-2 py-0.5 rounded">{result.codigo}</span></p>
            </div>
          ) : (
            <p className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {result.error}
            </p>
          )}
        </div>
      )}

      <button 
        type="submit" 
        disabled={loading}
        className="w-full py-4 rounded-xl font-bold text-lg text-white bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 shadow-[0_0_20px_rgba(22,163,74,0.4)] transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:shadow-none border border-green-400/30 mt-4"
      >
        {loading ? 'Procesando...' : 'Guardar Predicción'}
      </button>
    </form>
  );
}
