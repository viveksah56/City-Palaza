import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResetPasswordForm } from "./reset-password-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false, follow: false } };

export default function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  return (
    <Suspense fallback={<ResetPasswordSkeleton />}>
      <ResetPasswordContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ResetPasswordContent({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5 py-10">
      <Card className="w-full max-w-[420px] gap-7 rounded-2xl border-border/80 px-0 py-8 shadow-card sm:py-9">
        <CardHeader className="gap-2 px-7 sm:px-8">
          <p className="text-sm font-medium text-primary">Account recovery</p>
          <CardTitle className="text-[1.8rem] tracking-[-0.035em]">Choose a new password</CardTitle>
          <CardDescription className="text-sm leading-6">Use at least 10 characters with uppercase, lowercase and a number.</CardDescription>
        </CardHeader>
        <CardContent className="px-7 sm:px-8"><ResetPasswordForm token={token} /></CardContent>
        <div className="px-7 text-center text-sm sm:px-8"><Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">Back to sign in</Link></div>
      </Card>
    </main>
  );
}

function ResetPasswordSkeleton() {
  return (
    <main aria-busy="true" aria-label="Loading password reset form" className="flex min-h-dvh items-center justify-center bg-background px-5 py-10">
      <Card className="w-full max-w-[420px] gap-7 rounded-2xl border-border/80 px-0 py-8 shadow-card sm:py-9">
        <CardHeader className="gap-3 px-7 sm:px-8">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-64 max-w-full" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent className="space-y-5 px-7 sm:px-8">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    </main>
  );
}
