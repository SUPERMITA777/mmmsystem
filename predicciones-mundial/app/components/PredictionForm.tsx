'use client';

import { useState } from 'react';
import { submitPrediction } from '../actions';

type Partido = {
  id: string;
  equipo_local: string;
  equipo_visitante: string;
  fecha_hora: string;
  estado: string;
};

export default function PredictionForm({ partido }: { partido: Partido }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; error?: string; data?: any } | null>(null);

  async function action(formData: FormData) {
    setLoading(true);
    setResult(null);
    const res = await submitPrediction(formData);
    setResult(res);
    setLoading(false);
  }

  if (result?.success) {
    return (
      <div className="bg-green-50 p-4 rounded-lg border border-green-200 mt-4">
        <h3 className="text-green-800 font-bold text-lg mb-2">¡Predicción enviada!</h3>
        <p className="text-green-700 text-sm mb-4">
          Guarda este código para canjear tu premio si aciertas:
        </p>
        <div className="bg-white px-4 py-3 rounded text-center border border-green-300">
          <span className="text-2xl font-mono font-bold text-green-900 tracking-widest">
            {result.data.codigo_alfanumerico}
          </span>
        </div>
        <p className="text-green-600 text-xs mt-3 text-center">
          También te enviamos un mensaje por WhatsApp con esta información.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mt-4 space-y-4">
      <input type="hidden" name="partido_id" value={partido.id} />
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre y Apellido</label>
        <input 
          type="text" 
          name="nombre_cliente" 
          required 
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-base"
          placeholder="Ej: Juan Pérez"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp (con código de país)</label>
        <input 
          type="tel" 
          name="whatsapp" 
          inputMode="numeric"
          required 
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-base"
          placeholder="Ej: 5491123456789"
        />
        <p className="text-xs text-gray-500 mt-1">Solo números, sin el signo +. Es indispensable para validar tu premio.</p>
      </div>

      <div className="pt-2 border-t border-gray-100">
        <p className="text-sm font-medium text-gray-700 mb-3 text-center">Tu Predicción del Marcador</p>
        <div className="flex items-center justify-center gap-4">
          <div className="text-center">
            <span className="block text-xs text-gray-500 mb-1">{partido.equipo_local}</span>
            <input 
              type="number" 
              name="prediccion_local" 
              inputMode="numeric"
              min="0"
              required 
              className="w-16 h-16 text-center text-2xl font-bold border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <span className="text-gray-400 font-bold">-</span>
          <div className="text-center">
            <span className="block text-xs text-gray-500 mb-1">{partido.equipo_visitante}</span>
            <input 
              type="number" 
              name="prediccion_visitante" 
              inputMode="numeric"
              min="0"
              required 
              className="w-16 h-16 text-center text-2xl font-bold border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>
      </div>

      {result?.error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">
          {result.error}
        </div>
      )}

      <button 
        type="submit" 
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-colors disabled:opacity-50 min-h-[44px]"
      >
        {loading ? 'Enviando...' : 'Enviar Predicción'}
      </button>
    </form>
  );
}
