import { redirect } from "next/navigation";
import { BarChart3, Boxes, ScanLine } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const requestedNext = (await searchParams).next;
  const redirectTo = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/dashboard";
  if (await getSessionUser()) redirect("/dashboard");
  return (
    <main className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1.08fr)_minmax(440px,0.92fr)]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-sidebar px-12 py-10 text-sidebar-foreground lg:flex xl:px-16 xl:py-12">
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 size-[30rem] rounded-full border border-white/[0.06]" />
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 size-[20rem] rounded-full border border-white/[0.06]" />
        <div className="relative flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-sidebar-active font-heading text-lg font-semibold">C</span>
          <span className="font-heading text-[21px] font-semibold tracking-[-0.03em]">CityPalaza</span>
        </div>

        <div className="relative max-w-xl py-12">
          <p className="mb-5 text-sm font-medium text-sidebar-accent">Store operations</p>
          <h1 className="font-heading text-[3.25rem] leading-[1.08] font-semibold tracking-[-0.04em] text-balance xl:text-[3.75rem]">A clearer view of every phone and every sale.</h1>
          <p className="mt-6 max-w-md text-base leading-7 text-sidebar-muted">Keep product variants, serial numbers, stock levels and customer payments connected in one reliable workspace.</p>

          <div className="mt-12 grid max-w-lg grid-cols-3 border-t border-sidebar-border pt-6">
            <div className="pr-4">
              <Boxes className="mb-4 size-5 text-sidebar-accent" strokeWidth={1.7} />
              <p className="text-sm font-medium">Stock control</p>
              <p className="mt-1.5 text-xs leading-5 text-sidebar-muted">Variant-level inventory</p>
            </div>
            <div className="border-l border-sidebar-border px-4">
              <ScanLine className="mb-4 size-5 text-sidebar-accent" strokeWidth={1.7} />
              <p className="text-sm font-medium">IMEI tracking</p>
              <p className="mt-1.5 text-xs leading-5 text-sidebar-muted">Device-level records</p>
            </div>
            <div className="border-l border-sidebar-border pl-4">
              <BarChart3 className="mb-4 size-5 text-sidebar-accent" strokeWidth={1.7} />
              <p className="text-sm font-medium">Sales insights</p>
              <p className="mt-1.5 text-xs leading-5 text-sidebar-muted">Clear daily reporting</p>
            </div>
          </div>
        </div>

        <p className="relative text-xs text-sidebar-muted">© {new Date().getFullYear()} CityPalaza · Store management</p>
      </section>

      <section className="relative flex min-h-dvh items-center justify-center px-5 py-10 sm:px-8">
        <div className="absolute top-5 right-5 sm:top-8 sm:right-8"><ThemeToggle /></div>
        <div className="rise w-full max-w-[420px]">
          <div className="mb-9 flex items-center justify-center gap-2.5 lg:hidden">
            <span className="grid size-9 place-items-center rounded-lg bg-primary font-heading text-base font-semibold text-primary-foreground">C</span>
            <span className="font-heading text-lg font-semibold tracking-[-0.025em]">CityPalaza</span>
          </div>
          <Card className="gap-7 rounded-2xl border-border/80 px-0 py-8 shadow-card sm:py-9">
            <CardHeader className="gap-2 px-7 sm:px-8">
              <p className="text-sm font-medium text-primary">Welcome back</p>
              <CardTitle className="text-[1.8rem] tracking-[-0.035em] sm:text-[2rem]">Sign in to your workspace</CardTitle>
              <CardDescription className="text-sm leading-6">Use the work email and password provided by your administrator.</CardDescription>
            </CardHeader>
            <CardContent className="px-7 sm:px-8">
              <LoginForm redirectTo={redirectTo} />
            </CardContent>
          </Card>
          <p className="mt-6 text-center text-xs text-muted-foreground">Need access? Contact your CityPalaza administrator.</p>
        </div>
      </section>
    </main>
  );
}
