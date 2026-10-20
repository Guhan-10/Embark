"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Bell, LogOut, Menu, Search, Settings, UserRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { signOutAction } from "@/features/auth/actions";
import { useUnreadCount } from "@/hooks/use-notifications";
import { initials } from "@/lib/utils/format";
import { Logo } from "./logo";
import { SidebarNav } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";
import type { NavItem } from "./nav";

type NavbarProps = {
  user: { name: string; email: string; roleName: string; employeeId: string | null };
  navItems: NavItem[];
  unreadCount: number;
  canSearchEmployees: boolean;
  canOpenSettings: boolean;
  /** The main thing this person does, shown as the dark pill button (e.g. "Add employee" for HR). */
  primaryAction: { href: string; label: string } | null;
};

const roundIcon = "size-10 rounded-full border bg-card shadow-xs";

export function Navbar({ user, navItems, unreadCount, canSearchEmployees, canOpenSettings, primaryAction }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, startSignOut] = useTransition();
  const unread = useUnreadCount(unreadCount);

  return (
    <header className="sticky top-0 z-30 flex h-[76px] items-center gap-3 bg-background/85 px-4 backdrop-blur sm:px-6 lg:px-10">
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className={`${roundIcon} lg:hidden`} aria-label="Open menu">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-72 border-none bg-sidebar p-0 py-5 [&>button]:text-sidebar-foreground [&>button]:hover:bg-sidebar-accent [&>button]:hover:text-white"
        >
          <SheetHeader className="px-6 pb-6">
            <SheetTitle>
              <Logo tone="light" />
            </SheetTitle>
            <SheetDescription className="sr-only">Main navigation</SheetDescription>
          </SheetHeader>
          <SidebarNav items={navItems} onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>
      <Link href="/dashboard" className="lg:hidden" aria-label="Embark dashboard">
        <Logo className="[&>span]:hidden sm:[&>span]:inline" />
      </Link>

      {canSearchEmployees ? (
        <form action="/employees" role="search" className="relative hidden w-full max-w-xs md:block">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            type="search"
            placeholder="Search employees"
            aria-label="Search employees"
            className="h-11 w-full rounded-full border bg-card pr-4 pl-10 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          />
        </form>
      ) : null}

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle className={roundIcon} />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" asChild className={`${roundIcon} relative`}>
              <Link href="/notifications" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
                <Bell />
                {unread > 0 ? (
                  <span className="absolute -top-0.5 -right-0.5 flex min-w-[18px] items-center justify-center rounded-full border-2 border-background bg-destructive px-1 text-[10px] leading-[14px] font-bold text-destructive-foreground">
                    {unread > 99 ? "99+" : unread}
                  </span>
                ) : null}
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Notifications</TooltipContent>
        </Tooltip>

        {canOpenSettings ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" asChild className={`${roundIcon} hidden sm:inline-flex`}>
                <Link href="/settings" aria-label="Settings">
                  <Settings />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>
        ) : null}

        {primaryAction ? (
          <Button asChild className="hidden h-11 rounded-full bg-primary-strong px-5 text-primary-strong-foreground hover:bg-primary-strong/90 sm:inline-flex">
            <Link href={primaryAction.href}>{primaryAction.label}</Link>
          </Button>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Account menu"
              className="rounded-full focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              <Avatar className="size-11 border-2 border-card shadow-xs">
                <AvatarFallback className="bg-mint text-sm font-bold text-primary-ink">{initials(user.name)}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2">
            <DropdownMenuLabel className="font-normal">
              <span className="block text-sm font-semibold">{user.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
              <span className="mt-2 inline-flex rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                {user.roleName}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {user.employeeId ? (
              <DropdownMenuItem asChild>
                <Link href={`/employees/${user.employeeId}`}>
                  <UserRound /> My profile
                </Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem asChild>
              <Link href="/notifications">
                <Bell /> Notifications
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {/* Called directly: a form inside the menu would unmount (and never submit) when the menu closes. */}
            <DropdownMenuItem disabled={signingOut} onSelect={() => startSignOut(() => signOutAction())}>
              <LogOut /> {signingOut ? "Signing out…" : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
