import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Access denied" };

export default function ForbiddenPage() {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="max-w-sm text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-red/12 text-red"><ShieldAlert className="size-8" strokeWidth={1.5} aria-hidden /></span>
        <h1 className="mt-3 font-heading text-2xl font-semibold tracking-tight">You don’t have access to this page</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ask a CityPalaza admin if you need this permission.</p>
        <Button asChild className="mt-5"><Link href="/dashboard">Back to dashboard</Link></Button>
      </div>
    </main>
  );
}
