"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";

export type FilterOption = { value: string; label: string };

/** A URL-backed dropdown filter (e.g. ?category=smartphones). Resets to page 1 on change. */
export function FilterSelect({ param, label, options, allLabel = "All", className }: { param: string; label: string; options: FilterOption[]; allLabel?: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (
    <div className={className ?? "w-full sm:w-48"}>
      <NativeSelect
        className="h-9 rounded-md border-border bg-background shadow-none"
        aria-label={label}
        value={sp.get(param) ?? ""}
        onChange={(e) => {
          const next = new URLSearchParams(sp.toString());
          if (e.target.value) next.set(param, e.target.value); else next.delete(param);
          next.delete("page");
          router.replace(`${pathname}${next.size ? `?${next}` : ""}`);
        }}
      >
        <option value="">{label}: {allLabel}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </NativeSelect>
    </div>
  );
}
