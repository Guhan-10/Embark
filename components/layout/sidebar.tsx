"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  FileText,
  LayoutGrid,
  ListChecks,
  Route,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import { LogoMark } from "./logo";
import type { NavIcon, NavItem } from "./nav";

export const NAV_ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutGrid,
  employees: Users,
  onboarding: Route,
  tasks: ListChecks,
  documents: FileText,
  notifications: Bell,
  reports: BarChart3,
  settings: Settings,
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Full-width links with labels, for the mobile drawer. */
export function SidebarNav({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-1 px-3">
      {items.map((item) => {
        const Icon = NAV_ICONS[item.icon];
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none",
              active ? "bg-sidebar-active text-sidebar-active-foreground shadow-sm" : "text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-white",
            )}
          >
            <Icon className="size-[18px] shrink-0" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Desktop navigation: the logo, then a teal rail of icon buttons curving off the left edge.
 * The active section is a light tile; every icon has a tooltip and an accessible label.
 */
export function Sidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[88px] flex-col py-6 lg:flex">
      <Link href="/dashboard" aria-label="Embark dashboard" className="mx-auto rounded-2xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        <LogoMark className="size-11" />
      </Link>
      <nav
        aria-label="Main"
        className="my-auto flex w-[76px] flex-col items-center gap-2 rounded-r-[2.25rem] bg-sidebar py-7 shadow-sidebar"
      >
        {items.map((item) => {
          const Icon = NAV_ICONS[item.icon];
          const active = isActive(pathname, item.href);
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex size-12 items-center justify-center rounded-2xl transition-all focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none",
                    active
                      ? "bg-sidebar-active text-sidebar-active-foreground shadow-md"
                      : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-white",
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                {item.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    </aside>
  );
}
