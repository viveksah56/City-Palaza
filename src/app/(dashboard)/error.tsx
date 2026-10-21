"use client";
import { ErrorState } from "@/components/shared/states";

export default function DashboardError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorState digest={error.digest} onRetry={retry} />;
}
