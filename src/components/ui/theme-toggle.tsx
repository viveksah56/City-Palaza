"use client";

import * as React from "react";
import { Check, Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Theme = "light" | "dark" | "system";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const current = (theme ?? "system") as Theme;
  const Icon = current === "dark" ? Moon : current === "light" ? Sun : Laptop;

  return (
    <TooltipProvider delayDuration={450} skipDelayDuration={150}>
      <Tooltip>
        <DropdownMenu>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" aria-label={`Theme: ${current}`} suppressHydrationWarning>
                <Icon aria-hidden />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onSelect={() => setTheme("light")}><Sun aria-hidden />Light{current === "light" && <Check className="ml-auto" aria-hidden />}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setTheme("dark")}><Moon aria-hidden />Dark{current === "dark" && <Check className="ml-auto" aria-hidden />}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setTheme("system")}><Laptop aria-hidden />System{current === "system" && <Check className="ml-auto" aria-hidden />}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <TooltipContent>Appearance: {current}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
