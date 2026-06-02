"use client";

import { useState } from 'react';
import { X, Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabaseClient';


function getField(item: any, possibleKeys: string[]): any {
  for (const key of possibleKeys) {
    if (item[key] !== undefined) return item[key];
    // Check case-insensitive
    const foundKey = Object.keys(item || {}).find(k => k.toLowerCase() === key.toLowerCase());
    if (foundKey !== undefined) return item[foundKey];
  }
  return undefined;
}

interface ImportarMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  sucursalId: string;
  onSuccess: () => void;
}

export default function ImportarMenuModal({ isOpen, onClose, sucursalId, onSuccess }: ImportarMenuModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error', message: string }>({ type: 'idle', message: '' });
  const [progress, setProgress] = useState(0);

  if (!isOpen) return null;

  async function handleImport() {
    if (!file || !sucursalId) return;

    setLoading(true);
    setStatus({ type: 'idle', message: 'Leyendo archivo...' });
    setProgress(0);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // --- 1. Importar Productos ---
          const sheetProds = workbook.Sheets["Productos"] || workbook.Sheets[workbook.SheetNames[0]];
          const rowsProds: any[] = XLSX.utils.sheet_to_json(sheetProds);

          if (rowsProds.length > 0) {
            setStatus({ type: 'idle', message: `Procesando ${rowsProds.length} productos...` });

            // Coleccionar categorías únicas (soporta Categoría, Categoria, categoria, etc.)
            const categoryNames = [...new Set(rowsProds.map(item => getField(item, ['Categoría', 'Categoria', 'categoria'])).filter(Boolean))];
            const catMap: Record<string, string> = {};

            for (const catName of categoryNames) {
              const { data: existing } = await supabase
                .from('categorias')
                .select('id')
                .eq('sucursal_id', sucursalId)
                .eq('nombre', catName)
                .maybeSingle();

              if (existing) {
                catMap[catName as string] = existing.id;
              } else {
                const { data: newCat, error: catErr } = await supabase
                  .from('categorias')
                  .insert([{ sucursal_id: sucursalId, nombre: catName, activo: true }])
                  .select()
                  .single();
                if (catErr) throw catErr;
                if (newCat) catMap[catName as string] = newCat.id;
              }
            }

            for (let i = 0; i < rowsProds.length; i++) {
              const item = rowsProds[i];
              const id = getField(item, ['ID', 'id', 'Id']);
              const nombre = getField(item, ['Nombre Producto', 'Nombre', 'nombre']);
              const categoria = getField(item, ['Categoría', 'Categoria', 'categoria']);
              if (!nombre || !catMap[categoria]) continue;

              const precio = parseFloat(getField(item, ['Precio Venta', 'Precio', 'precio'])) || 0;
              
              const sugeridoRaw = getField(item, ['Es producto sugerido', 'sugerido', 'Sugerido']);
              const sugerido = sugeridoRaw === true || sugeridoRaw === 'true' || sugeridoRaw === 1 || sugeridoRaw === 'SI' || sugeridoRaw === 'si';
              
              const ocultoRaw = getField(item, ['Es producto oculto', 'oculto', 'Oculto']);
              const oculto = ocultoRaw === true || ocultoRaw === 'true' || ocultoRaw === 1 || ocultoRaw === 'SI' || ocultoRaw === 'si';
              
              const activoRaw = getField(item, ['Está activo', 'activo', 'Activo']);
              const activo = activoRaw === true || activoRaw === 'true' || activoRaw === 1 || activoRaw === undefined || activoRaw === 'SI' || activoRaw === 'si';
              
              const desc = getField(item, ['Descripción Producto', 'Descripción', 'Descripcion', 'descripcion']) || '';
              const imagenUrl = getField(item, ['Imagen Producto', 'URL Imagen', 'imagen', 'Imagen']) || '';
              const nombreInterno = getField(item, ['Nombre Interno Producto', 'Nombre Interno', 'nombre_interno']) || nombre;

              let existingId = null;

              if (id) {
                const { data: byId } = await supabase
                  .from('productos')
                  .select('id')
                  .eq('id', id)
                  .eq('sucursal_id', sucursalId)
                  .maybeSingle();
                if (byId) {
                  existingId = byId.id;
                }
              }

              if (!existingId) {
                const { data: byName } = await supabase
                  .from('productos')
                  .select('id')
                  .eq('sucursal_id', sucursalId)
                  .eq('nombre', nombre)
                  .limit(1);
                if (byName && byName.length > 0) {
                  existingId = byName[0].id;
                }
              }

              const payload = {
                sucursal_id: sucursalId,
                categoria_id: catMap[categoria],
                nombre: nombre,
                nombre_interno: nombreInterno,
                descripcion: desc,
                precio: precio,
                imagen_url: imagenUrl,
                producto_sugerido: sugerido,
                producto_oculto: oculto,
                activo: activo,
                visible_en_menu: !oculto
              };

              if (existingId) {
                const { error: updateErr } = await supabase
                  .from('productos')
                  .update(payload)
                  .eq('id', existingId);
                if (updateErr) throw updateErr;
              } else {
                const { error: insertErr } = await supabase
                  .from('productos')
                  .insert([payload]);
                if (insertErr) throw insertErr;
              }

              setProgress(Math.round(((i + 1) / rowsProds.length) * 50));
            }
          }

          // --- 2. Importar Adicionales ---
          const sheetAds = workbook.Sheets["Adicionales"];
          if (sheetAds) {
            const rowsAds: any[] = XLSX.utils.sheet_to_json(sheetAds);
            if (rowsAds.length > 0) {
              setStatus({ type: 'idle', message: `Procesando ${rowsAds.length} adicionales...` });
              
              const groupMap: Record<string, string> = {};

              for (let i = 0; i < rowsAds.length; i++) {
                const item = rowsAds[i];
                const optId = getField(item, ['ID', 'id', 'Id']);
                const gName = getField(item, ['Grupo', 'grupo']);
                const oName = getField(item, ['Opción', 'Opcion', 'opcion']);
                if (!gName || !oName) continue;

                // 2.1 Upsert Grupo
                if (!groupMap[gName]) {
                  const { data: existingG } = await supabase
                    .from('grupos_adicionales')
                    .select('id')
                    .eq('sucursal_id', sucursalId)
                    .eq('nombre', gName)
                    .limit(1);
                  
                  if (existingG && existingG.length > 0) {
                    groupMap[gName] = existingG[0].id;
                  } else {
                    const { data: newG, error: groupErr } = await supabase
                      .from('grupos_adicionales')
                      .insert([{
                        sucursal_id: sucursalId,
                        nombre: gName,
                        seleccion_obligatoria: getField(item, ['Obligatorio', 'obligatorio']) === 'SI',
                        seleccion_minima: parseInt(getField(item, ['Mínimo', 'Minimo', 'minimo'])) || 0,
                        seleccion_maxima: parseInt(getField(item, ['Máximo', 'Maximo', 'maximo'])) || 1
                      }])
                      .select()
                      .single();
                    if (groupErr) throw groupErr;
                    if (newG) groupMap[gName] = newG.id;
                  }
                }

                // 2.2 Upsert Opción (Adicional)
                let existingOptId = null;

                if (optId) {
                  const { data: byId } = await supabase
                    .from('adicionales')
                    .select('id')
                    .eq('id', optId)
                    .eq('sucursal_id', sucursalId)
                    .maybeSingle();
                  if (byId) {
                    existingOptId = byId.id;
                  }
                }

                if (!existingOptId && groupMap[gName]) {
                  const { data: byName } = await supabase
                    .from('adicionales')
                    .select('id')
                    .eq('grupo_id', groupMap[gName])
                    .eq('nombre', oName)
                    .limit(1);
                  if (byName && byName.length > 0) {
                    existingOptId = byName[0].id;
                  }
                }

                const adPayload = {
                  sucursal_id: sucursalId,
                  grupo_id: groupMap[gName],
                  nombre: oName,
                  precio_venta: parseFloat(getField(item, ['Precio Venta', 'Precio', 'precio'])) || 0,
                  precio_costo: parseFloat(getField(item, ['Precio Costo', 'PrecioCosto', 'precio_costo'])) || 0,
                  visible: getField(item, ['Visible', 'visible']) !== 'NO'
                };

                if (existingOptId) {
                  const { error: updateErr } = await supabase
                    .from('adicionales')
                    .update(adPayload)
                    .eq('id', existingOptId);
                  if (updateErr) throw updateErr;
                } else {
                  const { error: insertErr } = await supabase
                    .from('adicionales')
                    .insert([adPayload]);
                  if (insertErr) throw insertErr;
                }

                setProgress(50 + Math.round(((i + 1) / rowsAds.length) * 50));
              }
            }
          }

          setStatus({ type: 'success', message: '¡Catálogo actualizado correctamente!' });
          onSuccess();
          setTimeout(onClose, 2000);
        } catch (err: any) {
          setStatus({ type: 'error', message: err.message || 'Error al procesar el Excel' });
        } finally {
          setLoading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Error al leer el archivo' });
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-slate-900">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
              <Upload size={18} />
            </div>
            <h3 className="font-semibold text-slate-800">Importar Menú (Excel)</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg transition-colors text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {!file ? (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-8 hover:border-purple-400 hover:bg-purple-50 transition-all cursor-pointer group">
              <input 
                type="file" 
                className="hidden" 
                accept=".xlsx,.xls" 
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <div className="p-3 bg-slate-100 rounded-full text-slate-400 group-hover:bg-purple-100 group-hover:text-purple-600 transition-colors mb-3">
                <FileText size={32} />
              </div>
              <p className="text-sm font-medium text-slate-700">Seleccioná tu archivo Excel</p>
              <p className="text-xs text-slate-400 mt-1">.xlsx o .xls solamente</p>
            </label>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <FileText className="text-purple-600" size={24} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
                  <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                {!loading && (
                  <button onClick={() => setFile(null)} className="text-xs text-red-500 hover:underline">Quitar</button>
                )}
              </div>

              {loading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{status.message}</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-600 transition-all duration-300" 
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {status.type === 'success' && (
                <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-xl border border-green-100 text-sm">
                  <CheckCircle2 size={18} />
                  {status.message}
                </div>
              )}

              {status.type === 'error' && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm">
                  <AlertCircle size={18} />
                  {status.message}
                </div>
              )}

              {!loading && status.type !== 'success' && (
                <button
                  onClick={handleImport}
                  className="w-full py-2.5 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 flex items-center justify-center gap-2"
                >
                  <Upload size={18} />
                  Iniciar Importación
                </button>
              )}
            </div>
          )}

          <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
            <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-1">Pasos a seguir:</h4>
            <ul className="text-xs text-blue-700 space-y-1 list-disc pl-4">
              <li>Asegurate de usar el formato oficial de MMM Pizza.</li>
              <li>El sistema creará las categorías automáticamente si no existen.</li>
              <li>Si el producto ya existe (por nombre), se actualizará con los datos del Excel.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
