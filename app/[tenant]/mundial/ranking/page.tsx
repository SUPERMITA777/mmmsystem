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
          // Anonymize name: "Juan Perez" -> "Juan P."
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

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-900 text-white p-4 shadow-md sticky top-0 z-10 flex items-center">
        <Link href={`/${tenant}/mundial`} className="text-white mr-4">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold">Tabla de Posiciones</h1>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-6 mt-4">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 text-gray-600 text-sm">
                <th className="p-3 font-semibold text-center w-12">#</th>
                <th className="p-3 font-semibold">Participante</th>
                <th className="p-3 font-semibold text-right">Pts</th>
              </tr>
            </thead>
            <tbody>
              {ranking.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-6 text-center text-gray-500">
                    Aún no hay puntos asignados.
                  </td>
                </tr>
              ) : (
                ranking.map((user, index) => (
                  <tr key={index} className="border-t border-gray-100">
                    <td className="p-3 text-center text-gray-500 font-medium">
                      {index + 1}
                    </td>
                    <td className="p-3 font-medium text-gray-800">
                      {user.nombre}
                    </td>
                    <td className="p-3 text-right font-bold text-blue-600">
                      {user.puntos}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
