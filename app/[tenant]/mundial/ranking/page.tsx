import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

export const revalidate = 60; // Cache for 60 seconds

export default async function RankingPage({ params }: { params: Promise<{ tenant: string }> }) {
  const resolvedParams = await params;
  const tenant = resolvedParams.tenant;

  const { data: sucursal } = await supabase
    .from('sucursales')
    .select('id')
    .eq('slug', tenant)
    .single();

  let ranking: { nombre: string, puntos: number }[] = [];

  if (sucursal) {
    const sucursalId = sucursal.id;

    // Fetch predictions for this sucursal with points > 0
    const { data: predicciones, error } = await supabase
      .from('mundial_predicciones')
      .select('nombre_cliente, whatsapp, puntos_obtenidos')
      .eq('sucursal_id', sucursalId)
      .gt('puntos_obtenidos', 0);

    if (predicciones) {
      const userMap = new Map<string, { nombre: string, puntos: number }>();
      
      for (const p of predicciones) {
        if (userMap.has(p.whatsapp)) {
          userMap.get(p.whatsapp)!.puntos += p.puntos_obtenidos;
        } else {
          const parts = p.nombre_cliente.trim().split(' ');
          const anonName = parts.length > 1 
            ? `${parts[0]} ${parts[1][0]}.` 
            : parts[0];
            
          userMap.set(p.whatsapp, { nombre: anonName, puntos: p.puntos_obtenidos });
        }
      }
      
      ranking = Array.from(userMap.values()).sort((a, b) => b.puntos - a.puntos);
    }
  }

  const top3 = ranking.slice(0, 3);
  const others = ranking.slice(3);

  // Pad top3 to always have 3 elements for the podium layout
  while (top3.length < 3) {
    top3.push({ nombre: '---', puntos: 0 });
  }

  return (
    <div className="min-h-screen pb-24 bg-[#0f172a] bg-[url('https://images.unsplash.com/photo-1518605368461-1ee7e161228b?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-fixed bg-center text-white relative">
      <div className="absolute inset-0 bg-[#0f172a]/85 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1e40af]/40 via-transparent to-[#0f172a] pointer-events-none"></div>
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0f172a]/80 backdrop-blur-xl border-b border-white/10 shadow-xl">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center relative">
          <Link href={`/${tenant}/mundial`} className="text-white hover:text-yellow-400 transition-colors absolute left-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <h1 className="flex-1 text-center text-xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-200 drop-shadow-md uppercase">
            Salón de la Fama
          </h1>
        </div>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-8 relative z-10 mt-6">
        
        {/* Podium VIP Section */}
        {ranking.length > 0 && (
          <section className="mb-12">
            <div className="flex items-end justify-center gap-2 h-64 pt-8">
              {/* Second Place */}
              <div className="flex flex-col items-center w-1/3 z-10">
                <div className="relative mb-2">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 p-[2px] shadow-[0_0_15px_rgba(156,163,175,0.5)]">
                    <div className="w-full h-full rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-2xl">🥈</div>
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-gray-300 text-gray-900 text-xs font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-[#0f172a]">2</div>
                </div>
                <div className="text-center mb-2">
                  <p className="text-sm font-bold text-gray-200 truncate w-full px-1">{top3[1].nombre}</p>
                  <p className="text-xs font-black text-gray-400">{top3[1].puntos} pts</p>
                </div>
                <div className="w-full h-24 bg-gradient-to-t from-gray-400/20 to-gray-300/40 rounded-t-xl border-t border-x border-gray-300/30 backdrop-blur-md flex items-start justify-center pt-2">
                </div>
              </div>

              {/* First Place */}
              <div className="flex flex-col items-center w-1/3 z-20 -mb-4">
                <div className="relative mb-2">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-300 via-yellow-400 to-yellow-600 p-[2px] shadow-[0_0_30px_rgba(250,204,21,0.6)]">
                    <div className="w-full h-full rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-4xl">🏆</div>
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-yellow-400 text-yellow-900 text-sm font-black w-8 h-8 rounded-full flex items-center justify-center border-2 border-[#0f172a]">1</div>
                </div>
                <div className="text-center mb-2">
                  <p className="text-base font-black text-yellow-300 truncate w-full px-1">{top3[0].nombre}</p>
                  <p className="text-sm font-black text-yellow-500">{top3[0].puntos} pts</p>
                </div>
                <div className="w-full h-32 bg-gradient-to-t from-yellow-600/30 to-yellow-400/50 rounded-t-2xl border-t-2 border-x border-yellow-400/50 backdrop-blur-md flex items-start justify-center pt-3 shadow-[0_-10px_20px_rgba(250,204,21,0.15)]">
                </div>
              </div>

              {/* Third Place */}
              <div className="flex flex-col items-center w-1/3 z-10">
                <div className="relative mb-2">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-amber-700 p-[2px] shadow-[0_0_15px_rgba(217,119,6,0.5)]">
                    <div className="w-full h-full rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-xl">🥉</div>
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-amber-600 text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-[#0f172a]">3</div>
                </div>
                <div className="text-center mb-2">
                  <p className="text-sm font-bold text-orange-200 truncate w-full px-1">{top3[2].nombre}</p>
                  <p className="text-xs font-black text-orange-400">{top3[2].puntos} pts</p>
                </div>
                <div className="w-full h-20 bg-gradient-to-t from-amber-700/20 to-orange-500/30 rounded-t-xl border-t border-x border-orange-400/30 backdrop-blur-md flex items-start justify-center pt-2">
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Rest of the ranking */}
        <section>
          <div className="bg-white/5 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-white/10">
            {ranking.length === 0 ? (
              <div className="p-10 text-center text-gray-400 font-medium">
                <div className="text-4xl mb-4 opacity-50">👻</div>
                Aún no hay puntos asignados en este torneo.
              </div>
            ) : (
              <ul className="divide-y divide-white/5">
                {others.map((user, index) => (
                  <li key={index} className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-4">
                      <span className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-gray-400 font-black text-sm border border-white/5">
                        {index + 4}
                      </span>
                      <span className="font-bold text-gray-200">{user.nombre}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                      <span className="text-blue-400 font-black">{user.puntos}</span>
                      <span className="text-[10px] text-blue-500/70 font-bold uppercase">pts</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0f172a]/90 backdrop-blur-xl border-t border-white/10 z-50 pb-safe">
        <div className="max-w-md mx-auto flex justify-around items-center h-16 px-6">
          <a href={`/${tenant}/mundial`} className="flex flex-col items-center justify-center w-full h-full text-gray-400 hover:text-white transition-colors">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            <span className="text-[10px] font-bold uppercase tracking-wider">Partidos</span>
          </a>
          <a href={`/${tenant}/mundial/ranking`} className="flex flex-col items-center justify-center w-full h-full text-yellow-400">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <span className="text-[10px] font-bold uppercase tracking-wider">Ranking</span>
          </a>
        </div>
      </nav>
    </div>
  );
}
