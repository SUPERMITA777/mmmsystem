"use client";

import { useEffect, useState } from "react";
import { Download, CheckCircle } from "lucide-react";

export function InstallPwaButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if the app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isInstalled) {
      return; // Already installed
    }

    if (!deferredPrompt) {
      alert("La instalación automática no está disponible en este navegador o la app ya está instalada. Si estás en iOS/Safari, usa la opción 'Agregar a Inicio' del menú Compartir.");
      return;
    }
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('El usuario aceptó la instalación');
      setIsInstalled(true);
    }
    
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  if (isInstalled) {
    return (
      <button 
        disabled
        className="px-4 py-1.5 text-xs bg-green-50 border border-green-200 text-green-700 rounded-lg font-semibold flex items-center gap-2 cursor-not-allowed transition-all"
      >
        <CheckCircle size={16} />
        Sistema Instalado
      </button>
    );
  }

  return (
    <button 
      onClick={handleInstallClick}
      className={`px-4 py-1.5 text-xs text-white rounded-lg hover:opacity-90 font-semibold shadow-sm transition-all flex items-center gap-2 ${
        isInstallable ? 'bg-[#7B1FA2] hover:bg-[#6A1B9A]' : 'bg-gray-500 hover:bg-gray-600'
      }`}
      title={!isInstallable ? "Instalación automática no disponible" : "Instalar sistema offline"}
    >
      <Download size={16} />
      Instalar Sistema
    </button>
  );
}
