
import { createClient } from '@supabase/supabase-client'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function debug() {
  const tenant = 'zeta' // Assuming tenant name from context or request if possible, but I'll try to find sucursales
  
  console.log("--- Sucursales ---")
  const { data: sucs } = await supabase.from('sucursales').select('id, nombre, slug')
  console.log(JSON.stringify(sucs, null, 2))

  if (sucs && sucs.length > 0) {
    const sid = sucs[0].id
    console.log(`\n--- Debugging Sucursal ID: ${sid} ---`)

    const { data: cats } = await supabase.from('categorias').select('id, nombre, activo, sucursal_id')
    console.log("\nCategorias:")
    console.log(JSON.stringify(cats, null, 2))

    const { data: prods } = await supabase.from('productos').select('id, nombre, activo, categoria_id, visible_en_menu, sucursal_id').limit(20)
    console.log("\nProductos (sample):")
    console.log(JSON.stringify(prods, null, 2))
    
    const { count: totalProds } = await supabase.from('productos').select('*', { count: 'exact', head: true })
    console.log(`\nTotal Productos en DB: ${totalProds}`)
  }
}

debug()
