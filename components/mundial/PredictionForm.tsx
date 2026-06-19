'use client';

import { useState, useRef } from 'react';
import { submitPrediction } from '@/app/[tenant]/mundial/actions';

export default function PredictionForm({ partido, sucursalId }: { partido: any, sucursalId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [prediccionLocal, setPrediccionLocal] = useState('');
  const [prediccionVisitante, setPrediccionVisitante] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  const handleLucky = () => {
    setPrediccionLocal(Math.floor(Math.random() * 6).toString());
    setPrediccionVisitante(Math.floor(Math.random() * 6).toString());
  };

  const handleInitialSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (prediccionLocal === '' || prediccionVisitante === '') {
      alert('Por favor ingresa tu predicción primero.');
      return;
    }
    setShowModal(true);
  };

  async function handleFinalSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const formData = new FormData(e.currentTarget);
    formData.append('sucursal_id', sucursalId);
    formData.append('partido_id', partido.id);
    formData.append('prediccion_local', prediccionLocal);
    formData.append('prediccion_visitante', prediccionVisitante);
    
    const urlParts = window.location.pathname.split('/');
    const tenant = urlParts[1];
    formData.append('tenant', tenant);

    const res = await submitPrediction(formData);
    setResult(res);
    setLoading(false);
    
    if (res.success) {
      setShowModal(false);
    }
  }

  return (
    <>
      {/* Main Form */}
      <form onSubmit={handleInitialSubmit} className="space-y-5">
        <div className="flex gap-4 justify-center items-center">
          <div className="w-20">
            <input 
              type="number" 
              value={prediccionLocal}
              onChange={(e) => setPrediccionLocal(e.target.value)}
              min="0" max="20" required 
              placeholder="0"
              className="w-full text-center text-3xl font-black bg-white/10 text-white placeholder-white/20 border-2 border-white/10 rounded-2xl py-3 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all"
            />
          </div>
          <div className="text-gray-500 font-bold">-</div>
          <div className="w-20">
            <input 
              type="number" 
              value={prediccionVisitante}
              onChange={(e) => setPrediccionVisitante(e.target.value)}
              min="0" max="20" required 
              placeholder="0"
              className="w-full text-center text-3xl font-black bg-white/10 text-white placeholder-white/20 border-2 border-white/10 rounded-2xl py-3 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button 
            type="button" 
            onClick={handleLucky}
            className="flex-1 py-3 rounded-xl font-bold text-sm text-yellow-900 bg-gradient-to-r from-yellow-400 to-yellow-300 hover:from-yellow-300 hover:to-yellow-200 shadow-[0_0_15px_rgba(250,204,21,0.3)] transition-all transform active:scale-[0.98] border border-yellow-200/50"
          >
            🎲 Voy a tener suerte
          </button>
          <button 
            type="submit" 
            className="flex-1 py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 shadow-[0_0_15px_rgba(22,163,74,0.4)] transition-all transform active:scale-[0.98] border border-green-400/30"
          >
            Siguiente ➡️
          </button>
        </div>

        {result && !showModal && (
          <div className={`p-4 rounded-xl text-sm font-bold shadow-lg ${result.success ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
            {result.success ? (
              <div>
                <p className="flex items-center gap-2 mb-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  ¡Predicción guardada!
                </p>
                <p className="font-normal text-xs opacity-90 mt-2">Tu código: <span className="font-mono text-white text-base bg-black/30 px-2 py-0.5 rounded">{result.data?.codigo_alfanumerico}</span></p>
              </div>
            ) : (
              <p className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {result.error}
              </p>
            )}
          </div>
        )}
      </form>

      {/* Modal for User Data */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-5 border-b border-white/5 bg-white/5">
              <h3 className="text-lg font-bold text-white flex justify-between items-center">
                Completa tus datos
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </h3>
            </div>
            <form onSubmit={handleFinalSubmit} className="p-5 space-y-4">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-4 text-sm text-blue-200 flex items-center gap-3">
                <div className="text-2xl font-black tracking-widest">{prediccionLocal} - {prediccionVisitante}</div>
                <div className="text-xs opacity-80 leading-tight">Esta es tu predicción. Ingresa tus datos para registrarla.</div>
              </div>

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

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl font-bold text-white bg-green-600 hover:bg-green-500 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Enviando...' : 'Confirmar Predicción'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
