"use client";

import { useState } from "react";

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

  const handleClick = (id: string) => {
    setActive(id);
    onChange?.(id);
  };

  return (
    <div className="border-b border-slate-100 mb-2 md:mb-6 relative group">
      {/* Scroll indicator fade - Right */}
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white to-transparent pointer-events-none z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="flex gap-1 overflow-x-auto custom-scrollbar-hide pb-px mask-fade-right">
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
