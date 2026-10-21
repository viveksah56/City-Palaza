"use client";
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/** Debounced search box that stores the term in the URL (?search=iphone) and resets paging. */
export function SearchInput({ placeholder = "Search…", param = "search", label = "Search" }: { placeholder?: string; param?: string; label?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [value, setValue] = React.useState(sp.get(param) ?? "");
  const first = React.useRef(true);

  React.useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => {
      const next = new URLSearchParams(sp.toString());
      if (value.trim()) next.set(param, value.trim()); else next.delete(param);
      next.delete("page");
      router.replace(`${pathname}${next.size ? `?${next}` : ""}`);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative w-full sm:w-72 lg:w-80">
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input type="search" aria-label={label} placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} className="h-9 rounded-md border-border bg-background pl-9 shadow-none placeholder:text-muted-foreground/80" />
    </div>
  );
}
