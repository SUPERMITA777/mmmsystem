import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// We use service key to bypass RLS in the background job
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: Request) {
  // Simple auth for cron: check a secret token in headers or query params
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  
  if (token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Fetch active matches (en_curso or pendiente but past start time)
    // To simplify, let's fetch all 'en_curso' and those 'pendiente' that should have started
    const { data: partidosToSync, error: errFetch } = await supabase
      .from('partidos')
      .select('*')
      .in('estado', ['pendiente', 'en_curso'])
      .lte('fecha_hora', new Date().toISOString());

    if (errFetch || !partidosToSync || partidosToSync.length === 0) {
      return NextResponse.json({ message: 'No matches to sync', count: 0 });
    }

    let processedCount = 0;

    // 2. For each match, call the Sports API (Mocked here, since we don't have a real key yet)
    for (const partido of partidosToSync) {
      // -- MOCK API CALL START --
      // En una implementación real, aquí llamaríamos a football-data.org o TheSportsDB
      // const res = await fetch(`https://api.football-data.org/v4/matches/${partido.id_externo}`, { headers: { 'X-Auth-Token': '...' }});
      // const apiMatch = await res.json();
      
      const isFinished = false; // apiMatch.status === 'FINISHED'
      const homeScore = null;   // apiMatch.score.fullTime.home
      const awayScore = null;   // apiMatch.score.fullTime.away
      // -- MOCK API CALL END --

      // Update state if match started but was 'pendiente'
      if (partido.estado === 'pendiente') {
        await supabase.from('partidos').update({ estado: 'en_curso' }).eq('id', partido.id);
      }

      // If the match finished, we update results and calculate predictions
      if (isFinished && homeScore !== null && awayScore !== null) {
        // Update match
        await supabase
          .from('partidos')
          .update({ 
            resultado_local: homeScore, 
            resultado_visitante: awayScore, 
            estado: 'finalizado' 
          })
          .eq('id', partido.id);

        // Fetch points config
        const { data: configRows } = await supabase.from('configuracion').select('*');
        const getConf = (key: string, def: number) => {
          const row = configRows?.find(r => r.clave === key);
          return row ? Number(row.valor) : def;
        };
        const ptsExacto = getConf('puntos_acierto_exacto', 3);
        const ptsParcial = getConf('puntos_acierto_parcial', 1);

        // Fetch predictions for this match
        const { data: predicciones } = await supabase
          .from('predicciones')
          .select('*')
          .eq('partido_id', partido.id);

        if (predicciones) {
          for (const pred of predicciones) {
            let esExacto = false;
            let esParcial = false;
            let puntos = 0;

            if (pred.prediccion_local === homeScore && pred.prediccion_visitante === awayScore) {
              esExacto = true;
              puntos = ptsExacto;
            } else {
              // Determine winner
              const realWinner = homeScore > awayScore ? 'local' : (homeScore < awayScore ? 'visit' : 'draw');
              const predWinner = pred.prediccion_local > pred.prediccion_visitante ? 'local' : (pred.prediccion_local < pred.prediccion_visitante ? 'visit' : 'draw');
              
              if (realWinner === predWinner) {
                esParcial = true;
                puntos = ptsParcial;
              }
            }

            if (puntos > 0 || esExacto || esParcial) {
              await supabase
                .from('predicciones')
                .update({ 
                  es_acierto_exacto: esExacto, 
                  es_acierto_parcial: esParcial, 
                  puntos_obtenidos: puntos 
                })
                .eq('id', pred.id);
            }
          }
        }
        processedCount++;
      }
    }

    return NextResponse.json({ message: 'Sync complete', processedCount });
  } catch (error) {
    console.error('Error during cron sync:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
