"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, BarChart3, Bell, Boxes, ChevronRight, LayoutDashboard, MoreHorizontal, ScrollText, Settings, ShoppingCart, Smartphone, UserCog, Users, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { SignOutConfirmation } from "./sign-out-confirmation";
import Image from "next/image";

const ICONS: Record<string, LucideIcon> = { LayoutDashboard, ShoppingCart, Smartphone, Boxes, Users, BarChart3, UserCog, ScrollText, Settings };

export type ShellNavItem = { title: string; href: string; icon: string };
export type ShellProps = {
  nav: ShellNavItem[];
  user: { name: string; email: string; roleLabel: string };
  shopName: string;
  notifications: { count: number; items: { id: string; slug: string; name: string; quantity: number }[] };
  logoutAction: () => Promise<void | { ok: false }>;
  children: React.ReactNode;
};

const LABELS: Record<string, string> = {
  dashboard: "Dashboard", sales: "Sales", new: "New", products: "Products", categories: "Categories & brands", brands: "Brands",
  inventory: "Inventory", history: "History", customers: "Customers", reports: "Reports", employees: "Employees",
  "audit-logs": "Audit logs", settings: "Settings",
};

function Breadcrumbs() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-1 text-[13px] text-muted-foreground">
        {parts.map((part, index) => {
          const href = "/" + parts.slice(0, index + 1).join("/");
          const label = LABELS[part] ?? "Details";
          const last = index === parts.length - 1;
          return (
            <li key={href} className={cn("flex items-center gap-1", !last && "max-sm:hidden")}>
              {index > 0 && <ChevronRight className="size-3.5 opacity-60 max-sm:hidden" aria-hidden />}
              {last ? <span aria-current="page" className="truncate font-medium text-foreground">{label}</span> : <Link href={href} className="transition-colors hover:text-foreground">{label}</Link>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Brand({ name, onDark = false }: { name: string; onDark?: boolean }) {
  return (
    <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5 rounded-lg outline-none">
      <Image src="/citypalaza-icon.png" alt="" width={36} height={36} className={cn("size-9 shrink-0 rounded-lg object-cover", onDark && "ring-1 ring-sidebar-border")} />
      <span className={cn("truncate font-heading text-[18px] font-semibold tracking-[-0.025em] group-data-[collapsed=true]/sidebar:hidden max-sm:hidden", onDark ? "text-sidebar-foreground" : "text-foreground")}>{name}</span>
    </Link>
  );
}

function AppShellContent({ nav, user, shopName, notifications, logoutAction, children }: ShellProps) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  React.useEffect(() => setOpenMobile(false), [pathname, setOpenMobile]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const tabItems = nav.length > 5 ? nav.slice(0, 4) : nav;
  const hasMore = nav.length > 5;
  const navGroups = [
    { title: "Workspace", items: nav.filter((item) => !["/reports", "/audit-logs", "/employees", "/settings"].includes(item.href)) },
    { title: "Insights", items: nav.filter((item) => ["/reports", "/audit-logs"].includes(item.href)) },
    { title: "Admin", items: nav.filter((item) => ["/employees", "/settings"].includes(item.href)) },
  ].filter((group) => group.items.length > 0);

  return (
    <div className="flex min-h-dvh print:block">
      <a href="#main" className="sr-only z-[100] rounded-md bg-card px-4 py-2 text-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:shadow-pop">Skip to main content</a>
      <Sidebar className="print:hidden">
        <SidebarHeader className="px-4 py-5"><Brand name={shopName} onDark /></SidebarHeader>
        <SidebarContent>
          {navGroups.map((group) => <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const Icon = ICONS[item.icon] ?? LayoutDashboard;
                const active = isActive(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton asChild isActive={active} title={item.title}>
                          <Link href={item.href}>
                            <Icon strokeWidth={active ? 2.1 : 1.75} aria-hidden />
                            <span className="truncate group-data-[collapsed=true]/sidebar:hidden">{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent side="right">{item.title}</TooltipContent>
                    </Tooltip>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>)}
        </SidebarContent>
        <SidebarFooter>
          <div className="flex min-w-0 items-center gap-3 rounded-lg border border-sidebar-border bg-white/5 p-2.5 group-data-[collapsed=true]/sidebar:justify-center group-data-[collapsed=true]/sidebar:gap-0 group-data-[collapsed=true]/sidebar:border-transparent group-data-[collapsed=true]/sidebar:bg-transparent group-data-[collapsed=true]/sidebar:p-0">
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-sidebar-active text-xs font-semibold text-sidebar-foreground">{user.name.split(" ").slice(0, 2).map((part) => part[0]).join("")}</span>
            <div className="min-w-0 group-data-[collapsed=true]/sidebar:hidden"><p className="truncate text-[13px] font-semibold">{user.name}</p><p className="truncate text-xs text-sidebar-muted">{user.roleLabel}</p></div>
          </div>
        </SidebarFooter>
      </Sidebar>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-3 pt-[env(safe-area-inset-top)] sm:gap-3 sm:px-6 lg:px-8 print:hidden">
          <Tooltip>
            <TooltipTrigger asChild><SidebarTrigger /></TooltipTrigger>
            <TooltipContent>Toggle navigation</TooltipContent>
          </Tooltip>
          <div className="lg:hidden"><Brand name={shopName} /></div>
          <div className="hidden min-w-0 lg:block"><Breadcrumbs /></div>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative text-foreground hover:bg-muted hover:text-foreground" aria-label={`Notifications${notifications.count ? `, ${notifications.count} low-stock alerts` : ""}`}>
                      <Bell className="size-5" strokeWidth={2} aria-hidden />
                      {notifications.count > 0 && <span className="absolute -top-0.5 -right-0.5 grid min-w-[18px] place-items-center rounded-full bg-destructive px-1 text-[10px] leading-[18px] font-semibold text-destructive-foreground ring-2 ring-background">{notifications.count > 99 ? "99+" : notifications.count}</span>}
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Stock alerts</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-[min(20rem,calc(100vw-2rem))]">
                <DropdownMenuLabel>Stock alerts</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifications.items.length === 0 ? (
                  <p className="px-2.5 py-4 text-sm text-muted-foreground">Everything is stocked above its minimum.</p>
                ) : notifications.items.map((item) => (
                  <DropdownMenuItem key={item.id} asChild>
                    <Link href={`/products/${item.slug}`}><AlertTriangle className="text-orange" /><span className="flex-1 truncate">{item.name}</span><span className="num text-xs opacity-70">{item.quantity} left</span></Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link href="/inventory?stock=low">Show all stock alerts</Link></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <SignOutConfirmation action={logoutAction} />
          </div>
        </header>

        <main id="main" className="mx-auto min-w-0 w-full max-w-screen-2xl flex-1 px-3 pt-5 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:px-5 sm:pt-7 lg:px-8 lg:pt-8 lg:pb-14 print:p-0">{children}</main>
      </div>

      <nav aria-label="Primary" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card lg:hidden print:hidden">
        <ul className="mx-auto flex max-w-xl items-stretch justify-around px-2 pt-1.5 pb-1">
          {tabItems.map((item) => {
            const Icon = ICONS[item.icon] ?? LayoutDashboard;
            const active = isActive(item.href);
            return (
              <li key={item.href} className="flex-1">
                <Link href={item.href} aria-current={active ? "page" : undefined} className={cn("flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10.5px] font-medium transition-colors active:scale-95", active ? "text-primary" : "text-muted-foreground")}>
                  <Icon className="size-[23px]" strokeWidth={active ? 2.1 : 1.6} aria-hidden />{item.title}
                </Link>
              </li>
            );
          })}
          {hasMore && <li className="flex-1"><button type="button" onClick={() => setOpenMobile(true)} className="flex w-full flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10.5px] font-medium text-muted-foreground transition-colors active:scale-95"><MoreHorizontal className="size-[23px]" strokeWidth={1.6} aria-hidden />More</button></li>}
        </ul>
      </nav>
    </div>
  );
}

export function AppShell(props: ShellProps) {
  return <TooltipProvider delayDuration={450} skipDelayDuration={150}><SidebarProvider><AppShellContent {...props} /></SidebarProvider></TooltipProvider>;
}
