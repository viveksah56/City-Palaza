import * as React from "react";
import { AlertTriangle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-secondary text-muted-foreground" aria-hidden>{icon ?? <Inbox className="size-7" strokeWidth={1.5} />}</div>
      <h3 className="font-heading text-lg font-semibold tracking-tight">{title}</h3>
      {description && <p className="max-w-sm text-[15px] text-muted-foreground">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "This page didn’t load", description = "A temporary problem stopped the data from loading. Try again; if it keeps happening, tell an admin.", digest, onRetry }: { title?: string; description?: string; digest?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-red/12 text-red" aria-hidden><AlertTriangle className="size-7" strokeWidth={1.5} /></div>
      <h2 className="font-heading text-xl font-semibold tracking-tight">{title}</h2>
      <p className="text-[15px] text-muted-foreground">{description}</p>
      {digest && <p className="font-mono text-xs text-muted-foreground">Reference: {digest}</p>}
      {onRetry && <Button className="mt-2" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function LoadingSkeleton({ rows = 6, cards = 0 }: { rows?: number; cards?: number }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-3"><Skeleton className="h-10 w-56 sm:h-12" /><Skeleton className="h-4 w-80 max-w-full" /></div>
      {cards > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: cards }).map((_, i) => <Skeleton key={i} className="h-[118px] rounded-2xl" />)}
        </div>
      )}
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-card">
        <Skeleton className="mb-5 h-10 w-full max-w-sm" />
        <div className="space-y-3">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}</div>
      </div>
    </div>
  );
}
