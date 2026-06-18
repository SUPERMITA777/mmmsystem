import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  const partidos = [
    {
      equipo_local: 'Argentina',
      equipo_visitante: 'Canadá',
      fecha_hora: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // +2 days
      estado: 'pendiente'
    },
    {
      equipo_local: 'España',
      equipo_visitante: 'Croacia',
      fecha_hora: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // +3 days
      estado: 'pendiente'
    },
    {
      equipo_local: 'Brasil',
      equipo_visitante: 'Colombia',
      fecha_hora: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(), // +4 days
      estado: 'pendiente'
    }
  ];

  const { data, error } = await supabase.from('mundial_partidos').insert(partidos).select();
  if (error) {
    console.error("Error seeding:", error);
  } else {
    console.log("Seeded:", data);
  }
}

seed();
