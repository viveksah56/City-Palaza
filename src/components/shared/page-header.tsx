import * as React from "react";

/** Compact page title with a quiet subtitle; actions wrap under the title on small screens. */
export function PageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="mb-5 flex flex-col gap-3 border-b border-border/80 pb-5 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-heading text-[1.75rem] leading-tight font-semibold tracking-tight text-balance sm:text-[2rem]">{title}</h1>
        {description && <div className="mt-1.5 max-w-2xl text-sm text-muted-foreground sm:text-[15px]">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
    </header>
  );
}
