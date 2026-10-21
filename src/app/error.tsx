"use client";
import { ErrorState } from "@/components/shared/states";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <ErrorState digest={error.digest} onRetry={reset} />
    </main>
  );
}
