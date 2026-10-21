import Link from "next/link";
import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5 py-10">
      <Card className="w-full max-w-[420px] gap-7 rounded-2xl border-border/80 px-0 py-8 shadow-card sm:py-9">
        <CardHeader className="gap-2 px-7 sm:px-8">
          <p className="text-sm font-medium text-primary">Account recovery</p>
          <CardTitle className="text-[1.8rem] tracking-[-0.035em]">Reset your password</CardTitle>
          <CardDescription className="text-sm leading-6">Enter your work email. If an account matches, we’ll send a secure reset link.</CardDescription>
        </CardHeader>
        <CardContent className="px-7 sm:px-8"><ForgotPasswordForm /></CardContent>
        <div className="px-7 text-center text-sm sm:px-8"><Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">Back to sign in</Link></div>
      </Card>
    </main>
  );
}
