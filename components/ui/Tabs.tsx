"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Tab = {
  id: string;
  label: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
};

export function Tabs({
  tabs,
  initialId,
  onChange,
}: {
  tabs: Tab[];
  initialId?: string;
  onChange?: (id: string) => void;
}) {
  const [active, setActive] = useState(initialId ?? tabs[0]?.id);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const checkScroll = () => {
    const el = scrollContainerRef.current;
    if (el) {
      setShowLeftArrow(el.scrollLeft > 5);
      setShowRightArrow(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
    }
  };

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.addEventListener("scroll", checkScroll);
      checkScroll();
      window.addEventListener("resize", checkScroll);
      
      const timer = setTimeout(checkScroll, 200);
      return () => {
        el.removeEventListener("scroll", checkScroll);
        window.removeEventListener("resize", checkScroll);
        clearTimeout(timer);
      };
    }
  }, [tabs]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollContainerRef.current;
    if (el) {
      const scrollAmount = 240;
      el.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth"
      });
    }
  };

  const handleClick = (id: string) => {
    setActive(id);
    onChange?.(id);
  };

  return (
    <div className="border-b border-slate-100 mb-2 md:mb-6 relative group">
      {/* Scroll indicator fade & Arrow - Left */}
      {showLeftArrow && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-start bg-gradient-to-r from-white via-white/95 to-transparent z-20 text-slate-600 hover:text-[#7B1FA2] transition-all active:scale-90"
          title="Desplazar a la izquierda"
        >
          <ChevronLeft className="w-6 h-6 bg-white rounded-full shadow-md border border-slate-100 p-1 ml-1" />
        </button>
      )}
      
      {/* Scroll indicator fade & Arrow - Right */}
      {showRightArrow && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-0 bottom-0 w-12 flex items-center justify-end bg-gradient-to-l from-white via-white/95 to-transparent z-20 text-slate-600 hover:text-[#7B1FA2] transition-all active:scale-90"
          title="Desplazar a la derecha"
        >
          <ChevronRight className="w-6 h-6 bg-white rounded-full shadow-md border border-slate-100 p-1 mr-1" />
        </button>
      )}
      
      <div 
        ref={scrollContainerRef}
        className="flex gap-1 overflow-x-auto custom-scrollbar-hide pb-px mask-fade-right scroll-smooth"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              onClick={() => handleClick(tab.id)}
              className={`
                flex items-center gap-2 px-4 md:px-5 py-3 md:py-4 text-xs md:text-sm font-semibold whitespace-nowrap transition-all relative
                ${isActive
                  ? "text-[#7B1FA2] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#7B1FA2]"
                  : "text-slate-500 hover:text-slate-900"
                }
              `}
            >
              {Icon && <Icon size={16} />}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
      
      <style jsx global>{`
        .custom-scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .custom-scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}

export function TabPanel({
  id,
  activeId,
  children,
}: {
  id: string;
  activeId: string;
  children: React.ReactNode;
}) {
  if (id !== activeId) return null;
  return <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">{children}</div>;
}
