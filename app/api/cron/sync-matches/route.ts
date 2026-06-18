import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// We use service key to bypass RLS in the background job
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: Request) {
  // Simple auth for cron: check a secret token in headers or query params
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  
  if (token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Fetch active matches (en_curso or pendiente but past start time)
    const { data: partidosToSync, error: errFetch } = await supabaseAdmin
      .from('mundial_partidos')
      .select('*')
      .in('estado', ['pendiente', 'en_curso'])
      .lte('fecha_hora', new Date().toISOString());

    if (errFetch || !partidosToSync || partidosToSync.length === 0) {
      return NextResponse.json({ message: 'No matches to sync', count: 0 });
    }

    let processedCount = 0;

    // Fetch all points configs (to avoid querying per sucursal in the loop)
    const { data: configRows } = await supabaseAdmin.from('mundial_configuracion').select('*');
    
    const getPtsExacto = (sucursalId: string) => {
      const row = configRows?.find(r => r.sucursal_id === sucursalId && r.clave === 'puntos_acierto_exacto');
      return row ? Number(row.valor) : 3;
    };
    const getPtsParcial = (sucursalId: string) => {
      const row = configRows?.find(r => r.sucursal_id === sucursalId && r.clave === 'puntos_acierto_parcial');
      return row ? Number(row.valor) : 1;
    };

    // 2. For each match, call the Sports API (Mocked)
    for (const partido of partidosToSync) {
      // -- MOCK API CALL START --
      // En una implementación real, llamaríamos a football-data.org o TheSportsDB
      const isFinished = false; // apiMatch.status === 'FINISHED'
      const homeScore = null;   // apiMatch.score.fullTime.home
      const awayScore = null;   // apiMatch.score.fullTime.away
      // -- MOCK API CALL END --

      // Update state if match started but was 'pendiente'
      if (partido.estado === 'pendiente') {
        await supabaseAdmin.from('mundial_partidos').update({ estado: 'en_curso' }).eq('id', partido.id);
      }

      // If the match finished, we update results and calculate predictions globally
      if (isFinished && homeScore !== null && awayScore !== null) {
        // Update match
        await supabaseAdmin
          .from('mundial_partidos')
          .update({ 
            resultado_local: homeScore, 
            resultado_visitante: awayScore, 
            estado: 'finalizado' 
          })
          .eq('id', partido.id);

        // Fetch predictions for this match across ALL tenants
        const { data: predicciones } = await supabaseAdmin
          .from('mundial_predicciones')
          .select('*')
          .eq('partido_id', partido.id);

        if (predicciones) {
          for (const pred of predicciones) {
            let esExacto = false;
            let esParcial = false;
            let puntos = 0;

            const ptsExacto = getPtsExacto(pred.sucursal_id);
            const ptsParcial = getPtsParcial(pred.sucursal_id);

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
              await supabaseAdmin
                .from('mundial_predicciones')
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
