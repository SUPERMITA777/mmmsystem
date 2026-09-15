"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  GraduationCap,
  ImagePlus,
  Palette,
  MessageSquare,
  Type,
  Sparkles,
  Save,
  Trash2,
  Upload,
  Check,
  Loader2,
  X,
  Plus
} from "lucide-react";

interface BrandTrainingTabProps {
  sucursalId: string;
}

interface Logo {
  url: string;
  nombre: string;
}

interface ColoresMarca {
  primario: string;
  secundario: string;
  acento: string;
}

const ESTILOS_PREDETERMINADOS = [
  { id: "gourmet", label: "Gourmet", desc: "Elegante y refinado" },
  { id: "rapido", label: "Comida Rápida", desc: "Dinámico y apetitoso" },
  { id: "rustico", label: "Rústico / Artesanal", desc: "Cálido y tradicional" },
  { id: "minimalista", label: "Minimalista", desc: "Limpio y moderno" },
  { id: "neon", label: "Neón / Nocturno", desc: "Vibrante y oscuro" },
  { id: "fiesta", label: "Fiesta / Evento", desc: "Alegre y festivo" }
];

const SUGERENCIAS_TONO = [
  "Formal y Profesional",
  "Cercano e Informal",
  "Joven y Urbano",
  "Premium y Exclusivo",
  "Divertido y Creativo"
];

function compressImage(file: File, maxSize: number = 400): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width,
          h = img.height;
        if (w > h) {
          if (w > maxSize) {
            h = (h * maxSize) / w;
            w = maxSize;
          }
        } else {
          if (h > maxSize) {
            w = (w * maxSize) / h;
            h = maxSize;
          }
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function BrandTrainingTab({ sucursalId }: BrandTrainingTabProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [logos, setLogos] = useState<Logo[]>([]);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [estiloDefault, setEstiloDefault] = useState("gourmet");
  const [coloresMarca, setColoresMarca] = useState<ColoresMarca>({
    primario: "#7B1FA2",
    secundario: "#4A148C",
    acento: "#E1BEE7"
  });
  const [tonoComunicacion, setTonoComunicacion] = useState("");
  const [slogan, setSlogan] = useState("");
  const [instruccionesPermanentes, setInstruccionesPermanentes] = useState("");

  useEffect(() => {
    fetchData();
  }, [sucursalId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/marketing/brand-config?sucursal_id=${sucursalId}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        if (data) {
          if (data.logos && Array.isArray(data.logos)) setLogos(data.logos);
          if (data.estilo_default) setEstiloDefault(data.estilo_default);
          if (data.colores_marca) {
            setColoresMarca({
              primario: data.colores_marca.primario || "#7B1FA2",
              secundario: data.colores_marca.secundario || "#4A148C",
              acento: data.colores_marca.acento || "#E1BEE7"
            });
          }
          if (data.tono_comunicacion) setTonoComunicacion(data.tono_comunicacion);
          if (data.slogan) setSlogan(data.slogan);
          if (data.instrucciones_permanentes) setInstruccionesPermanentes(data.instrucciones_permanentes);
        }
      }
    } catch (error) {
      console.error("Error fetching brand config:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/marketing/brand-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sucursal_id: sucursalId,
          logos,
          estilo_default: estiloDefault,
          colores_marca: coloresMarca,
          tono_comunicacion: tonoComunicacion,
          slogan,
          instrucciones_permanentes: instruccionesPermanentes
        })
      });

      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        alert("Error al guardar la configuración");
      }
    } catch (error) {
      console.error("Error saving brand config:", error);
      alert("Error al guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    if (!file.type.startsWith("image/")) {
      alert("Por favor selecciona una imagen");
      return;
    }

    setUploadingLogo(true);
    try {
      const base64Img = await compressImage(file, 400);

      const res = await fetch(`/api/marketing/brand-logo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sucursal_id: sucursalId,
          image_data: base64Img,
          imagen_base64: base64Img,
          file_name: file.name,
          nombre: file.name
        })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        const cleanName = file.name.replace(/\.[^/.]+$/, "");
        const newLogo: Logo = json.logo || { url: json.url, nombre: cleanName };
        const updatedLogos = [...logos, newLogo];
        setLogos(updatedLogos);

        // Guardar automáticamente en la configuración para no requerir click en guardar
        await fetch(`/api/marketing/brand-config`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sucursal_id: sucursalId,
            logos: updatedLogos,
            estilo_default: estiloDefault,
            colores_marca: coloresMarca,
            tono_comunicacion: tonoComunicacion,
            slogan,
            instrucciones_permanentes: instruccionesPermanentes
          })
        });
      } else {
        alert(json.error || "Error al subir el logo");
      }
    } catch (error: any) {
      console.error("Error uploading logo:", error);
      alert(error.message || "Error al subir el logo");
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteLogo = async (url: string) => {
    if (!confirm("¿Eliminar este logo?")) return;
    try {
      await fetch(`/api/marketing/brand-logo`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sucursal_id: sucursalId, url })
      });

      const updatedLogos = logos.filter((l) => l.url !== url);
      setLogos(updatedLogos);

      await fetch(`/api/marketing/brand-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sucursal_id: sucursalId,
          logos: updatedLogos,
          estilo_default: estiloDefault,
          colores_marca: coloresMarca,
          tono_comunicacion: tonoComunicacion,
          slogan,
          instrucciones_permanentes: instruccionesPermanentes
        })
      });
    } catch (error) {
      console.error("Error deleting logo:", error);
      alert("Error al eliminar el logo");
    }
  };

  const handleLogoNameChange = (url: string, newName: string) => {
    setLogos(logos.map((l) => (l.url === url ? { ...l, nombre: newName } : l)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 text-[#7B1FA2] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#7B1FA2] to-[#9C27B0] text-white p-6 rounded-2xl shadow-md">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Entrenamiento de Marca</h1>
            <p className="text-purple-100 text-sm mt-1">
              Configurá los elementos permanentes que se aplicarán automáticamente en cada flyer generado
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Logos */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <ImagePlus className="w-5 h-5 text-[#7B1FA2]" />
              <h2 className="font-bold text-gray-800">Logos de la Marca</h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Hasta 3 logos que se incluirán automáticamente en todos los flyers
            </p>

            <div className="space-y-3">
              {logos.map((logo, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="w-16 h-16 flex-shrink-0 bg-white rounded-lg border border-gray-200 p-1 flex items-center justify-center overflow-hidden">
                    <img src={logo.url} alt={logo.nombre} className="max-w-full max-h-full object-contain" />
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      value={logo.nombre}
                      onChange={(e) => handleLogoNameChange(logo.url, e.target.value)}
                      placeholder="Nombre del logo (ej: Principal blanco)"
                      className="w-full text-sm font-medium bg-transparent border-none focus:ring-0 p-0 text-gray-700"
                    />
                    <p className="text-[10px] text-gray-400 mt-1 truncate">{logo.url}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteLogo(logo.url)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {logos.length < 3 && (
                <div
                  onClick={() => !uploadingLogo && fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                    uploadingLogo
                      ? "border-gray-200 bg-gray-50"
                      : "border-purple-200 bg-purple-50 hover:bg-purple-100 hover:border-purple-300"
                  }`}
                >
                  {uploadingLogo ? (
                    <Loader2 className="w-6 h-6 text-purple-400 animate-spin mb-2" />
                  ) : (
                    <Upload className="w-6 h-6 text-purple-400 mb-2" />
                  )}
                  <span className="text-sm font-bold text-purple-700">
                    {uploadingLogo ? "Subiendo..." : "Subir nuevo logo"}
                  </span>
                  <span className="text-xs text-purple-400/80 mt-1">PNG, JPG hasta 5MB</span>
                </div>
              )}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*"
                className="hidden"
              />
            </div>
          </div>

          {/* Colores */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="w-5 h-5 text-[#7B1FA2]" />
              <h2 className="font-bold text-gray-800">Colores de Marca</h2>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-2">Color Primario</label>
                <div className="relative">
                  <input
                    type="color"
                    value={coloresMarca.primario}
                    onChange={(e) => setColoresMarca({ ...coloresMarca, primario: e.target.value })}
                    className="w-full h-12 rounded-xl cursor-pointer border-0 p-1"
                  />
                  <div className="absolute inset-0 border border-gray-200 rounded-xl pointer-events-none" />
                </div>
                <div className="text-center mt-1 text-xs text-gray-500 font-mono">{coloresMarca.primario}</div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-2">Color Secundario</label>
                <div className="relative">
                  <input
                    type="color"
                    value={coloresMarca.secundario}
                    onChange={(e) => setColoresMarca({ ...coloresMarca, secundario: e.target.value })}
                    className="w-full h-12 rounded-xl cursor-pointer border-0 p-1"
                  />
                  <div className="absolute inset-0 border border-gray-200 rounded-xl pointer-events-none" />
                </div>
                <div className="text-center mt-1 text-xs text-gray-500 font-mono">{coloresMarca.secundario}</div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-2">Color Acento</label>
                <div className="relative">
                  <input
                    type="color"
                    value={coloresMarca.acento}
                    onChange={(e) => setColoresMarca({ ...coloresMarca, acento: e.target.value })}
                    className="w-full h-12 rounded-xl cursor-pointer border-0 p-1"
                  />
                  <div className="absolute inset-0 border border-gray-200 rounded-xl pointer-events-none" />
                </div>
                <div className="text-center mt-1 text-xs text-gray-500 font-mono">{coloresMarca.acento}</div>
              </div>
            </div>
          </div>
          
          {/* Slogan */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Type className="w-5 h-5 text-[#7B1FA2]" />
              <h2 className="font-bold text-gray-800">Slogan</h2>
            </div>
            
            <input
              type="text"
              value={slogan}
              onChange={(e) => setSlogan(e.target.value)}
              placeholder="Ej: El sabor que te enamora"
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
            />
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Estilo Predeterminado */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-[#7B1FA2]" />
              <h2 className="font-bold text-gray-800">Estilo Visual Predeterminado</h2>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {ESTILOS_PREDETERMINADOS.map((estilo) => (
                <button
                  key={estilo.id}
                  onClick={() => setEstiloDefault(estilo.id)}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    estiloDefault === estilo.id
                      ? "border-[#7B1FA2] bg-purple-50 shadow-sm"
                      : "border-gray-200 hover:border-purple-300 hover:bg-gray-50"
                  }`}
                >
                  <div className={`font-bold text-sm ${estiloDefault === estilo.id ? "text-[#7B1FA2]" : "text-gray-700"}`}>
                    {estilo.label}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{estilo.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Tono de Comunicación */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-5 h-5 text-[#7B1FA2]" />
              <h2 className="font-bold text-gray-800">Tono de Comunicación</h2>
            </div>
            
            <textarea
              value={tonoComunicacion}
              onChange={(e) => setTonoComunicacion(e.target.value)}
              placeholder="Ej: Comunicación cercana, informal, con modismos argentinos y emojis..."
              className="w-full border border-gray-200 rounded-xl p-3 min-h-[100px] text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all resize-none"
            />
            
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGERENCIAS_TONO.map((tono, idx) => (
                <button
                  key={idx}
                  onClick={() => setTonoComunicacion(tono)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-purple-100 hover:text-purple-700 text-gray-600 text-xs font-medium rounded-lg transition-colors"
                >
                  {tono}
                </button>
              ))}
            </div>
          </div>

          {/* Instrucciones Permanentes */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap className="w-5 h-5 text-[#7B1FA2]" />
              <h2 className="font-bold text-gray-800">Instrucciones Permanentes para la IA</h2>
            </div>
            
            <textarea
              value={instruccionesPermanentes}
              onChange={(e) => setInstruccionesPermanentes(e.target.value)}
              placeholder="Ej: Siempre incluir el logo en la esquina superior derecha, usar fondos oscuros, destacar los precios en amarillo..."
              className="w-full border border-gray-200 rounded-xl p-3 min-h-[120px] text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all resize-none"
            />
            <p className="text-xs text-gray-500 mt-2">
              Estas instrucciones se agregarán a todos los prompts generados por la IA de forma invisible.
            </p>
          </div>
        </div>
      </div>

      {/* Floating Save Button */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
        {saved && (
          <div className="bg-green-100 text-green-700 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 font-bold text-sm animate-fade-in">
            <Check className="w-5 h-5" />
            ¡Guardado con éxito!
          </div>
        )}
        
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-gradient-to-r from-[#7B1FA2] to-[#9C27B0] hover:from-[#6A1B9A] hover:to-[#8E24AA] text-white px-6 py-3 rounded-xl shadow-lg shadow-purple-300 font-bold flex items-center gap-2 transition-all hover:scale-105 active:scale-95 disabled:opacity-70 disabled:pointer-events-none"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Guardar Entrenamiento
        </button>
      </div>
    </div>
  );
}
