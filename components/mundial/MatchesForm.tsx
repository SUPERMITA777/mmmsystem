'use client';

import { useState } from 'react';
import { submitBulkPredictions } from '@/app/[tenant]/mundial/actions';

type Match = any;

export default function MatchesForm({ partidos, sucursalId, tenant }: { partidos: Match[], sucursalId: string, tenant: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  
  // State to hold predictions for all matches
  // Format: { matchId: { local: string, visitante: string } }
  const [predictions, setPredictions] = useState<Record<string, { local: string, visitante: string }>>({});

  const handleScoreChange = (matchId: string, type: 'local' | 'visitante', value: string) => {
    setPredictions(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [type]: value
      }
    }));
  };

  const handleLucky = (matchId: string) => {
    setPredictions(prev => ({
      ...prev,
      [matchId]: {
        local: Math.floor(Math.random() * 6).toString(),
        visitante: Math.floor(Math.random() * 6).toString()
      }
    }));
  };

  const hasAnyPrediction = Object.values(predictions).some(p => p.local !== '' && p.visitante !== '' && p.local !== undefined && p.visitante !== undefined);

  const handleInitialSubmit = () => {
    if (!hasAnyPrediction) {
      alert('Por favor completa al menos una predicción.');
      return;
    }
    setShowModal(true);
  };

  async function handleFinalSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const formData = new FormData(e.currentTarget);
    const nombre_cliente = formData.get('nombre_cliente') as string;
    const whatsapp = formData.get('whatsapp') as string;
    
    // Prepare data
    const validPredictions = Object.entries(predictions)
      .filter(([_, p]) => p.local !== '' && p.visitante !== '' && p.local !== undefined && p.visitante !== undefined)
      .map(([matchId, p]) => ({
        partido_id: matchId,
        prediccion_local: parseInt(p.local),
        prediccion_visitante: parseInt(p.visitante)
      }));

    const res = await submitBulkPredictions({
      sucursal_id: sucursalId,
      tenant,
      nombre_cliente,
      whatsapp,
      predicciones: validPredictions
    });

    setResult(res);
    setLoading(false);
    
    if (res.success) {
      setShowModal(false);
      // Clear form
      setPredictions({});
    }
  }

  return (
    <>
      <div className="space-y-6">
        {partidos.map((partido) => {
          const isStarted = new Date() >= new Date(partido.fecha_hora);
          const currentPred = predictions[partido.id] || { local: '', visitante: '' };
          
          return (
            <div key={partido.id} className="group bg-white/5 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-white/10 hover:border-white/20 transition-all duration-300 relative">
              {/* Glowing background effect on hover */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
              
              <div className="bg-black/20 px-5 py-3 flex justify-between items-center border-b border-white/5">
                <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  {partido.fecha_hora ? `${partido.fecha_hora.split('T')[0]} ${partido.fecha_hora.split('T')[1]?.substring(0, 5) || ''}` : ''}
                </span>
                {isStarted ? (
                  <span className="text-xs font-black text-red-500 flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 rounded-full border border-red-500/20">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
                    EN JUEGO
                  </span>
                ) : (
                  <span className="text-xs font-black text-blue-400 flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 rounded-full border border-blue-500/20">
                    PREVIA
                  </span>
                )}
              </div>
              
              <div className="p-6 relative z-10">
                <div className="flex justify-between items-center mb-6">
                  <div className="text-center flex-1">
                    <div className="w-16 h-16 mx-auto mb-3 bg-white/10 rounded-full flex items-center justify-center shadow-inner border border-white/5 overflow-hidden">
                      {partido.escudo_local ? (
                        <img src={partido.escudo_local} alt={partido.equipo_local} className="w-full h-full object-cover p-2" />
                      ) : (
                        <span className="text-2xl">🏳️</span>
                      )}
                    </div>
                    <p className="font-black text-lg text-white leading-tight">{partido.equipo_local}</p>
                  </div>
                  <div className="px-4 text-yellow-500/50 font-black text-2xl italic tracking-tighter">VS</div>
                  <div className="text-center flex-1">
                    <div className="w-16 h-16 mx-auto mb-3 bg-white/10 rounded-full flex items-center justify-center shadow-inner border border-white/5 overflow-hidden">
                      {partido.escudo_visitante ? (
                        <img src={partido.escudo_visitante} alt={partido.equipo_visitante} className="w-full h-full object-cover p-2" />
                      ) : (
                        <span className="text-2xl">🏳️</span>
                      )}
                    </div>
                    <p className="font-black text-lg text-white leading-tight">{partido.equipo_visitante}</p>
                  </div>
                </div>

                {isStarted ? (
                  <div className="bg-red-500/10 text-red-200 p-4 rounded-2xl text-sm text-center border border-red-500/20 font-medium">
                    Las predicciones están cerradas para este partido.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex gap-4 justify-center items-center">
                      <div className="w-20">
                        <input 
                          type="number" 
                          value={currentPred.local}
                          onChange={(e) => handleScoreChange(partido.id, 'local', e.target.value)}
                          min="0" max="20"
                          placeholder="0"
                          className="w-full text-center text-3xl font-black bg-white/10 text-white placeholder-white/20 border-2 border-white/10 rounded-2xl py-3 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all"
                        />
                      </div>
                      <div className="text-gray-500 font-bold">-</div>
                      <div className="w-20">
                        <input 
                          type="number" 
                          value={currentPred.visitante}
                          onChange={(e) => handleScoreChange(partido.id, 'visitante', e.target.value)}
                          min="0" max="20"
                          placeholder="0"
                          className="w-full text-center text-3xl font-black bg-white/10 text-white placeholder-white/20 border-2 border-white/10 rounded-2xl py-3 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all"
                        />
                      </div>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => handleLucky(partido.id)}
                      className="w-full py-2.5 rounded-xl font-bold text-xs text-yellow-900 bg-gradient-to-r from-yellow-400 to-yellow-300 hover:from-yellow-300 hover:to-yellow-200 shadow-[0_0_15px_rgba(250,204,21,0.2)] transition-all transform active:scale-[0.98] border border-yellow-200/50"
                    >
                      🎲 Voy a tener suerte
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {partidos.length > 0 && (
          <div className="sticky bottom-20 z-40 bg-[#0f172a]/90 backdrop-blur-xl p-4 rounded-3xl border border-white/10 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
            {result && !showModal && (
              <div className={`p-4 mb-4 rounded-xl text-sm font-bold shadow-lg ${result.success ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
                {result.success ? (
                  <div>
                    <p className="flex items-center gap-2 mb-1">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      ¡Tus predicciones han sido enviadas!
                    </p>
                    <p className="font-normal text-xs opacity-90 mt-1">En breve te llegará a tu whatsapp un mensaje con tus códigos.</p>
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
              onClick={handleInitialSubmit}
              disabled={!hasAnyPrediction}
              className="w-full py-4 rounded-xl font-black text-lg text-white bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 shadow-[0_0_20px_rgba(22,163,74,0.4)] transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:shadow-none border border-green-400/30"
            >
              ENVIAR PREDICCIONES
            </button>
          </div>
        )}
      </div>

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
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-4 text-sm text-blue-200 flex flex-col gap-2">
                <div className="text-xs opacity-80 leading-tight">Estás a punto de enviar predicciones para {Object.entries(predictions).filter(([_, p]) => p.local !== '' && p.visitante !== '').length} partido(s).</div>
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
                  {loading ? 'Enviando...' : 'Confirmar Todo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
