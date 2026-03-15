"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabaseClient";

interface MenuExportButtonProps {
  sucursalId: string;
}

export default function MenuExportButton({ sucursalId }: MenuExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (!sucursalId) return;
    setExporting(true);
    try {
      // 1. Fetch categories
      const { data: cats } = await supabase
        .from("categorias")
        .select("*")
        .eq("sucursal_id", sucursalId)
        .order("orden");

      // 2. Fetch products
      const { data: prods } = await supabase
        .from("productos")
        .select("*")
        .eq("sucursal_id", sucursalId);

      // 3. Fetch adicionales
      const { data: groups } = await supabase
        .from("grupos_adicionales")
        .select("*")
        .eq("sucursal_id", sucursalId);

      const { data: ads } = await supabase
        .from("adicionales")
        .select("*")
        .eq("sucursal_id", sucursalId);

      // 4. Format Products Data
      const productsData = (prods || []).map(p => {
        const cat = cats?.find(c => c.id === p.categoria_id);
        return {
          'ID': p.id,
          'Nombre Producto': p.nombre,
          'Nombre Interno Producto': p.nombre_interno || p.nombre,
          'Descripción Producto': p.descripcion || '',
          'Precio Venta': p.precio,
          'Precio Costo': p.precio_costo || 0,
          'Categoría': cat?.nombre || 'Sin Categoría',
          'URL Imagen': p.imagen_url || '',
          'Es producto sugerido': p.producto_sugerido ? 'SI' : 'NO',
          'Es producto oculto': p.producto_oculto ? 'SI' : 'NO',
          'Está activo': p.activo ? 'SI' : 'NO'
        };
      });

      // 5. Format Adicionales Data
      const adicionalesData = (ads || []).map(a => {
        const group = groups?.find(g => g.id === a.grupo_id);
        return {
          'ID': a.id,
          'Grupo': group?.nombre || 'Desconocido',
          'Opción': a.nombre,
          'Precio Venta': a.precio_venta,
          'Precio Costo': a.precio_costo || 0,
          'Visible': a.visible ? 'SI' : 'NO',
          'Obligatorio': group?.seleccion_obligatoria ? 'SI' : 'NO',
          'Mínimo': group?.seleccion_minima || 0,
          'Máximo': group?.seleccion_maxima || 1
        };
      });

      // 6. Create Workbook
      const wb = XLSX.utils.book_new();
      const wsProds = XLSX.utils.json_to_sheet(productsData);
      const wsAds = XLSX.utils.json_to_sheet(adicionalesData);
      
      XLSX.utils.book_append_sheet(wb, wsProds, "Productos");
      XLSX.utils.book_append_sheet(wb, wsAds, "Adicionales");

      // 7. Download
      XLSX.writeFile(wb, `menu_export_${new Date().toISOString().split('T')[0]}.xlsx`);

    } catch (err) {
      console.error("Error exporting menu:", err);
      alert("Error al exportar el menú");
    } finally {
      setExporting(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
        exporting 
          ? "bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed" 
          : "bg-white border-purple-200 text-purple-600 hover:bg-purple-50 hover:border-purple-300"
      }`}
    >
      {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
      {exporting ? "Exportando..." : "EXPORTAR MENU"}
    </button>
  );
}
