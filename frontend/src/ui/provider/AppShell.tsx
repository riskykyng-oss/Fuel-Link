import type { ReactNode } from "react";
import { Icon } from "../icons";
import type { IconName } from "../icons";
import { cn } from "../cn";

export interface SidebarNavItem {
  key: string;
  label: string;
  icon: IconName;
  badge?: number;
}

interface SidebarNavProps {
  items: SidebarNavItem[];
  activeKey: string;
  onSelect: (key: string) => void;
}

/** Vertical nav; the active item is lime-filled. Renders nothing when empty. */
export function SidebarNav({ items, activeKey, onSelect }: SidebarNavProps) {
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item.key)}
            className={cn(
              "flex min-h-11 w-full items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors",
              active
                ? "bg-lime text-lime-ink"
                : "text-muted hover:bg-surface hover:text-text",
            )}
          >
            <Icon name={item.icon} size={18} />
            <span className="flex-1 text-left">{item.label}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span
                className={cn(
                  "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
                  active ? "bg-lime-ink text-lime-text" : "bg-danger text-base",
                )}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

interface AppShellProps {
  activeKey: string;
  onSelect: (key: string) => void;
  navItems: SidebarNavItem[];
  header?: ReactNode;
  children: ReactNode;
}

/** Full provider layout: fixed sidebar + scrolling main column. */
export function AppShell({ activeKey, onSelect, navItems, header, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-base text-text">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 border-r border-border bg-surface p-4 lg:flex">
        <div className="flex items-center gap-2 px-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-control bg-lime text-lime-ink">
            <Icon name="nozzle" size={18} />
          </span>
          <span className="text-lg font-bold tracking-tight">
            Fuel<span className="text-lime-text">Link</span>
          </span>
        </div>
        <SidebarNav items={navItems} activeKey={activeKey} onSelect={onSelect} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        {header && <header className="sticky top-0 z-10 border-b border-border bg-base/95 backdrop-blur">{header}</header>}
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
