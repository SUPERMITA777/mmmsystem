import { supabase } from '@/lib/supabaseClient';
import PredictionForm from '@/components/mundial/PredictionForm';

// Cache revalidation for matches (every 60 seconds)
export const revalidate = 60;

export default async function MundialHome({ params }: { params: Promise<{ tenant: string }> }) {
  const resolvedParams = await params;
  const tenant = resolvedParams.tenant;

  // Resolve sucursal_id from tenant
  const { data: sucursal } = await supabase
    .from('sucursales')
    .select('id')
    .eq('slug', tenant)
    .single();

  if (!sucursal) {
    return <div>Sucursal no encontrada</div>;
  }
  const sucursalId = sucursal.id;

  // Fetch active banners for this sucursal
  const { data: banners } = await supabase
    .from('mundial_banners')
    .select('*')
    .eq('sucursal_id', sucursalId)
    .eq('activo', true);

  // Randomize banners for header and footer
  const activeBanners = banners || [];
  const shuffledBanners = [...activeBanners].sort(() => 0.5 - Math.random());
  const headerBanner = shuffledBanners[0] || null;
  const footerBanner = shuffledBanners.length > 1 ? shuffledBanners[1] : (shuffledBanners[0] || null);

  // Fetch upcoming matches (Global)
  // 'en_curso' and 'pendiente' matches
  const { data: partidos } = await supabase
    .from('mundial_partidos')
    .select('*')
    .in('estado', ['pendiente', 'en_curso'])
    .order('fecha_hora', { ascending: true });

  const renderBanner = (banner: any) => {
    if (!banner) return null;
    return (
      <div className="w-full max-w-md mx-auto my-6 rounded-2xl overflow-hidden shadow-lg border border-white/20 relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
        <a href={banner.link_destino || '#'} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={banner.imagen_url} 
            alt={banner.texto_alt || banner.nombre_anunciante} 
            className="w-full h-auto object-cover max-h-32"
          />
        </a>
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-24 bg-[#0f172a] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#15803d]/40 via-[#0f172a] to-[#0f172a] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0f172a]/80 backdrop-blur-xl border-b border-white/10 shadow-xl">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-center relative">
          <h1 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-200 drop-shadow-md uppercase">
            Copa Mundial
          </h1>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/3 h-0.5 bg-gradient-to-r from-transparent via-yellow-400 to-transparent"></div>
        </div>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-8 relative z-10">
        {/* Decorative elements */}
        <div className="absolute top-20 left-0 w-64 h-64 bg-green-500/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>
        <div className="absolute top-80 right-0 w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>

        {/* Header Banner */}
        {renderBanner(headerBanner)}

        <section>
          <div className="flex items-center justify-between mb-6 px-2">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" /></svg>
              Próximos Partidos
            </h2>
            <div className="px-3 py-1 bg-white/10 rounded-full text-xs font-medium text-yellow-400 border border-yellow-400/20 backdrop-blur-md">
              {partidos?.length || 0} Disponibles
            </div>
          </div>
          
          {(!partidos || partidos.length === 0) ? (
            <div className="bg-white/5 backdrop-blur-lg p-8 rounded-3xl shadow-xl text-center border border-white/10 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent"></div>
              <p className="text-gray-400 relative z-10 font-medium">No hay partidos programados en este momento.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {partidos.map((partido) => {
                const isStarted = new Date() >= new Date(partido.fecha_hora);
                
                return (
                  <div key={partido.id} className="group bg-white/5 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-white/10 hover:border-white/20 transition-all duration-300 relative">
                    {/* Glowing background effect on hover */}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                    
                    <div className="bg-black/20 px-5 py-3 flex justify-between items-center border-b border-white/5">
                      <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        {new Date(partido.fecha_hora).toLocaleString('es-AR', {
                          weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'
                        })}
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
                          <div className="w-16 h-16 mx-auto mb-3 bg-white/10 rounded-full flex items-center justify-center shadow-inner border border-white/5">
                            <span className="text-2xl">ðŸ³ï¸</span>
                          </div>
                          <p className="font-black text-lg text-white leading-tight">{partido.equipo_local}</p>
                        </div>
                        <div className="px-4 text-yellow-500/50 font-black text-2xl italic tracking-tighter">VS</div>
                        <div className="text-center flex-1">
                          <div className="w-16 h-16 mx-auto mb-3 bg-white/10 rounded-full flex items-center justify-center shadow-inner border border-white/5">
                            <span className="text-2xl">ðŸ³ï¸</span>
                          </div>
                          <p className="font-black text-lg text-white leading-tight">{partido.equipo_visitante}</p>
                        </div>
                      </div>

                      {isStarted ? (
                        <div className="bg-red-500/10 text-red-200 p-4 rounded-2xl text-sm text-center border border-red-500/20 font-medium">
                          Las predicciones estÃ¡n cerradas para este partido.
                        </div>
                      ) : (
                        <PredictionForm partido={partido} sucursalId={sucursalId} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Footer Banner */}
        {renderBanner(footerBanner)}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0f172a]/90 backdrop-blur-xl border-t border-white/10 z-50 pb-safe">
        <div className="max-w-md mx-auto flex justify-around items-center h-16 px-6">
          <a href={`/${tenant}/mundial`} className="flex flex-col items-center justify-center w-full h-full text-yellow-400">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            <span className="text-[10px] font-bold uppercase tracking-wider">Partidos</span>
          </a>
          <a href={`/${tenant}/mundial/ranking`} className="flex flex-col items-center justify-center w-full h-full text-gray-400 hover:text-white transition-colors">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <span className="text-[10px] font-bold uppercase tracking-wider">Ranking</span>
          </a>
          <a href={`/${tenant}/mundial/canjear`} className="flex flex-col items-center justify-center w-full h-full text-gray-400 hover:text-white transition-colors">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>
            <span className="text-[10px] font-bold uppercase tracking-wider">Canjear</span>
          </a>
        </div>
      </nav>
    </div>
  );
}
