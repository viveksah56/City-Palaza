import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="max-w-sm text-center">
        <p className="font-heading text-7xl font-semibold tracking-[-0.04em]">404</p>
        <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight">We can’t find that page</h1>
        <p className="mt-1 text-sm text-muted-foreground">The link may be old, or the record may belong to another employee.</p>
        <Button asChild className="mt-5"><Link href="/dashboard">Back to dashboard</Link></Button>
      </div>
    </main>
  );
}
