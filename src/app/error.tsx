"use client";
import { ErrorState } from "@/components/shared/states";

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <ErrorState digest={error.digest} onRetry={retry} />
    </main>
  );
}
