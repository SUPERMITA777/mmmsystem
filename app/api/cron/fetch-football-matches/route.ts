import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const FOOTBALL_DATA_TOKEN = '942a3eddd2e844b6b8e1bfbd5caf3994'; // Token provisto

export async function GET(request: Request) {
  // Verificación simple de cron auth si fuese necesario
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Buscar los próximos 10 partidos programados del Mundial (WC)
    const res = await fetch('https://api.football-data.org/v4/competitions/WC/matches?status=SCHEDULED', {
      headers: { 'X-Auth-Token': FOOTBALL_DATA_TOKEN }
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Error fetching football-data.org:', text);
      return NextResponse.json({ error: 'Failed to fetch API' }, { status: 500 });
    }

    const data = await res.json();
    const matches = data.matches || [];

    // Tomar solo los primeros 10
    const upcomingMatches = matches.slice(0, 10);

    let inserted = 0;

    // Guardar en la DB
    for (const match of upcomingMatches) {
      // El ID de la API externa
      const externalId = match.id.toString();

      // Upsert basado en id_externo (agregamos esta constraint o la verificamos manually)
      const { data: existing } = await supabaseAdmin
        .from('mundial_partidos')
        .select('id')
        .eq('id_externo', externalId)
        .single();

      if (!existing) {
        // Insertar nuevo
        await supabaseAdmin
          .from('mundial_partidos')
          .insert({
            equipo_local: match.homeTeam.name,
            equipo_visitante: match.awayTeam.name,
            escudo_local: match.homeTeam.crest,
            escudo_visitante: match.awayTeam.crest,
            fecha_hora: new Date(match.utcDate).toISOString(),
            estado: 'pendiente',
            fuente_resultado: 'api',
            id_externo: externalId
          });
        inserted++;
      } else {
        // Podríamos actualizar la hora si cambió
        await supabaseAdmin
          .from('mundial_partidos')
          .update({
            fecha_hora: new Date(match.utcDate).toISOString(),
            escudo_local: match.homeTeam.crest,
            escudo_visitante: match.awayTeam.crest,
          })
          .eq('id_externo', externalId);
      }
    }

    return NextResponse.json({ success: true, inserted, message: 'Partidos sincronizados' });

  } catch (error: any) {
    console.error('Error syncing matches:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
