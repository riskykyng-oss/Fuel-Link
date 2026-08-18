import type { ReactNode } from "react";
import { Icon } from "../icons";
import type { IconName } from "../icons";
import type { TabKey } from "../types";
import { cn } from "../cn";

export interface TabItem {
  key: string;
  icon: IconName;
  label: string;
}

const MOTORIST_TABS: TabItem[] = [
  { key: "home", icon: "home", label: "Home" },
  { key: "orders", icon: "receipt", label: "Orders" },
  { key: "profile", icon: "user", label: "Profile" },
];

interface BottomTabBarProps {
  active: string;
  onChange: (tab: string) => void;
  tabs?: TabItem[];
}

/** Bottom navigation; default set is the motorist tabs. Active tab is lime. */
export function BottomTabBar({ active, onChange, tabs = MOTORIST_TABS }: BottomTabBarProps) {
  return (
    <nav className="border-t border-border bg-surface px-2 pb-[env(safe-area-inset-bottom)]">
      <div className="flex">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={cn(
                "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-control text-[11px] font-medium transition-colors",
                isActive ? "text-lime-text" : "text-muted hover:text-text",
              )}
            >
              <Icon name={tab.icon} size={20} />
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

interface MobileShellProps {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

/** 390px-centred app frame for mobile app screens. */
export function MobileShell({ header, footer, children }: MobileShellProps) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col bg-base text-text">
      {header && <header className="sticky top-0 z-10 bg-base/95 backdrop-blur">{header}</header>}
      <main className="flex-1 px-4 pb-6">{children}</main>
      {footer}
    </div>
  );
}

export type { TabKey };
