"use client";
import { ErrorState } from "@/components/shared/states";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState digest={error.digest} onRetry={reset} />;
}
