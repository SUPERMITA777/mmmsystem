import { supabase } from '@/lib/supabase';
import PredictionForm from './components/PredictionForm';
import Image from 'next/image';

// Cache revalidation for matches (every 60 seconds)
export const revalidate = 60;

export default async function Home() {
  // Fetch active banners
  const { data: banners } = await supabase
    .from('banners')
    .select('*')
    .eq('activo', true);

  // Randomize banners for header and footer
  const activeBanners = banners || [];
  const shuffledBanners = [...activeBanners].sort(() => 0.5 - Math.random());
  const headerBanner = shuffledBanners[0] || null;
  const footerBanner = shuffledBanners.length > 1 ? shuffledBanners[1] : (shuffledBanners[0] || null);

  // Fetch upcoming matches
  // 'en_curso' and 'pendiente' matches
  const { data: partidos } = await supabase
    .from('partidos')
    .select('*')
    .in('estado', ['pendiente', 'en_curso'])
    .order('fecha_hora', { ascending: true });

  const renderBanner = (banner: any) => {
    if (!banner) return null;
    return (
      <div className="w-full max-w-md mx-auto my-4 rounded-xl overflow-hidden shadow-sm">
        <a href={banner.link_destino || '#'} target="_blank" rel="noopener noreferrer">
          {/* Using a regular img tag or next/image if domain is configured */}
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
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-blue-900 text-white p-4 shadow-md sticky top-0 z-10">
        <h1 className="text-xl font-bold text-center">Predicciones del Mundial</h1>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-6">
        {/* Header Banner */}
        {renderBanner(headerBanner)}

        <section>
          <h2 className="text-lg font-bold text-gray-800 mb-4 px-1">Próximos Partidos</h2>
          
          {(!partidos || partidos.length === 0) ? (
            <div className="bg-white p-6 rounded-xl shadow-sm text-center border border-gray-100">
              <p className="text-gray-500">No hay partidos programados en este momento.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {partidos.map((partido) => {
                const isStarted = new Date() >= new Date(partido.fecha_hora);
                
                return (
                  <div key={partido.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                    <div className="bg-gray-100 px-4 py-2 flex justify-between items-center border-b border-gray-200">
                      <span className="text-xs font-semibold text-gray-600 uppercase">
                        {new Date(partido.fecha_hora).toLocaleString('es-AR', {
                          weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'
                        })}
                      </span>
                      {isStarted ? (
                        <span className="text-xs font-bold text-red-600 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                          EN JUEGO
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-blue-600">PREVIA</span>
                      )}
                    </div>
                    
                    <div className="p-4">
                      <div className="flex justify-between items-center mb-4">
                        <div className="text-center flex-1">
                          <p className="font-bold text-lg text-gray-800">{partido.equipo_local}</p>
                        </div>
                        <div className="px-4 text-gray-400 font-bold text-xl">VS</div>
                        <div className="text-center flex-1">
                          <p className="font-bold text-lg text-gray-800">{partido.equipo_visitante}</p>
                        </div>
                      </div>

                      {isStarted ? (
                        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm text-center border border-red-100">
                          Las predicciones están cerradas para este partido.
                        </div>
                      ) : (
                        <PredictionForm partido={partido} />
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
    </div>
  );
}
