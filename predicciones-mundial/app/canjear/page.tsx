'use client';

import { useState } from 'react';
import Link from 'next/link';
import { canjearCodigo } from './actions';

export default function CanjearPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; error?: string; data?: any } | null>(null);

  async function action(formData: FormData) {
    setLoading(true);
    setResult(null);
    const res = await canjearCodigo(formData);
    setResult(res);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-900 text-white p-4 shadow-md sticky top-0 z-10 flex items-center">
        <Link href="/" className="text-white mr-4">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold">Canjear Premio</h1>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-6 mt-4">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-bold text-gray-800 mb-2">Reclama tu premio</h2>
          <p className="text-gray-600 text-sm mb-6">
            Ingresa el código de 6 dígitos que recibiste al hacer tu predicción ganadora.
          </p>

          {result?.success ? (
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <h3 className="text-green-800 font-bold text-lg mb-2">¡Canje Exitoso!</h3>
              <p className="text-green-700 font-medium mb-1">
                Ganaste: {result.data.premio_nombre}
              </p>
              <p className="text-green-600 text-sm">
                {result.data.premio_descripcion}
              </p>
              <div className="mt-4 pt-4 border-t border-green-200">
                <p className="text-sm text-green-800 font-bold">Acércate a caja o contacta al administrador para retirar tu premio.</p>
              </div>
            </div>
          ) : (
            <form action={action} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código de Canje</label>
                <input 
                  type="text" 
                  name="codigo" 
                  maxLength={6}
                  required 
                  className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest uppercase border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="EJ: AB12C3"
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
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-colors disabled:opacity-50 min-h-[44px]"
              >
                {loading ? 'Validando...' : 'Canjear'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
