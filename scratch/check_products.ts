
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkProducts() {
  const { data: sucursales } = await supabase.from("sucursales").select("id, nombre").limit(5);
  console.log("Sucursales:", sucursales);

  if (sucursales && sucursales.length > 0) {
      const sid = sucursales[0].id;
      const { data: prods, count } = await supabase.from("productos").select("*", { count: 'exact' }).eq("sucursal_id", sid);
      console.log(`Products for sucursal ${sid}:`, count);
      if (prods && prods.length > 0) {
          console.log("Sample product:", prods[0]);
      } else {
          const { data: allProds } = await supabase.from("productos").select("sucursal_id").limit(10);
          console.log("All products sucursal_ids:", allProds?.map(p => p.sucursal_id));
      }
  }
}

checkProducts();
