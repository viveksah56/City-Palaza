"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type SidebarContextValue = {
  collapsed: boolean;
  setCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  openMobile: boolean;
  setOpenMobile: React.Dispatch<React.SetStateAction<boolean>>;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) throw new Error("Sidebar components must be used inside SidebarProvider.");
  return context;
}

function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [openMobile, setOpenMobile] = React.useState(false);
  const value = React.useMemo(() => ({ collapsed, setCollapsed, openMobile, setOpenMobile }), [collapsed, openMobile]);
  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

function Sidebar({ children, className }: React.HTMLAttributes<HTMLElement>) {
  const { collapsed, openMobile, setOpenMobile } = useSidebar();
  const content = <div className="flex h-full min-h-0 flex-col">{children}</div>;
  return (
    <>
      <aside data-collapsed={collapsed} className={cn("group/sidebar hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:sticky lg:top-0 lg:flex", collapsed ? "w-[4.5rem]" : "w-[15.5rem]", className)}>
        {content}
      </aside>
      <Dialog open={openMobile} onOpenChange={setOpenMobile}>
        <DialogContent className="!top-0 !bottom-0 !left-0 !right-auto !h-dvh !max-h-dvh !w-[18rem] !max-w-none !translate-x-0 !translate-y-0 !rounded-none p-0">
          <DialogTitle className="sr-only">Main navigation</DialogTitle>
          <aside className="group/sidebar flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">{content}</aside>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SidebarHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-sidebar="header" className={cn("flex flex-col gap-2 p-3", className)} {...props} />;
}

function SidebarContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-sidebar="content" className={cn("flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2", className)} {...props} />;
}

function SidebarGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-sidebar="group" className={cn("flex min-w-0 flex-col gap-1.5", className)} {...props} />;
}

function SidebarGroupLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-sidebar="group-label" className={cn("px-3 py-2 text-xs font-medium text-sidebar-muted group-data-[collapsed=true]/sidebar:sr-only", className)} {...props} />;
}

function SidebarMenu({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  return <ul data-sidebar="menu" className={cn("flex min-w-0 flex-col gap-1", className)} {...props} />;
}

function SidebarMenuItem({ className, ...props }: React.LiHTMLAttributes<HTMLLIElement>) {
  return <li data-sidebar="menu-item" className={cn("min-w-0", className)} {...props} />;
}

function SidebarMenuButton({ asChild = false, isActive = false, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean; isActive?: boolean }) {
  const Component = asChild ? Slot : "button";
  return <Component data-sidebar="menu-button" data-active={isActive} aria-current={isActive ? "page" : undefined} className={cn("flex h-10 w-full min-w-0 items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-sidebar-muted outline-none transition-colors hover:bg-sidebar-active hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-accent data-[active=true]:bg-sidebar-active data-[active=true]:text-sidebar-foreground group-data-[collapsed=true]/sidebar:justify-center group-data-[collapsed=true]/sidebar:px-2 [&>svg]:size-[19px] [&>svg]:shrink-0", className)} {...props} />;
}

function SidebarFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-sidebar="footer" className={cn("mt-auto flex flex-col gap-2 border-t border-sidebar-border p-3", className)} {...props} />;
}

function SidebarTrigger({ className, onClick, ...props }: React.ComponentProps<typeof Button>) {
  const { collapsed, setCollapsed, setOpenMobile } = useSidebar();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("size-9", className)}
      aria-label="Toggle navigation"
      title="Toggle navigation"
      onClick={(event) => {
        onClick?.(event);
        if (window.matchMedia("(min-width: 1024px)").matches) setCollapsed((value) => !value);
        else setOpenMobile(true);
      }}
      {...props}
    >
      <PanelLeft aria-hidden />
    </Button>
  );
}

export { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar };
