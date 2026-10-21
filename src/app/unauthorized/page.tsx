import type { Metadata } from "next";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Sign in required" };

export default function UnauthorizedPage() {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="max-w-sm text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary"><LockKeyhole className="size-8" strokeWidth={1.5} aria-hidden /></span>
        <h1 className="mt-3 font-heading text-2xl font-semibold tracking-tight">Sign in to continue</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your session has ended or you haven’t signed in yet.</p>
        <Button asChild className="mt-5"><Link href="/login">Go to sign in</Link></Button>
      </div>
    </main>
  );
}
