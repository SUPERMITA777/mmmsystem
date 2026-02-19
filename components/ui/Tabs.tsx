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
    <div className="border-b border-slate-200 mb-6">
      <div className="flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => handleClick(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? "border-b-2 border-purple-600 text-purple-600"
                  : "text-slate-600 hover:text-slate-900 hover:border-b-2 hover:border-slate-300"
              }`}
            >
              {Icon && <Icon size={16} />}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
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
  return <div>{children}</div>;
}
