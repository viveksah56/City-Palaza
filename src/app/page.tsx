import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { getSessionClaims } from "@/lib/session";

export default function Home() {
  return (
    <Suspense fallback={<HomeLoading />}>
      <HomeRedirect />
    </Suspense>
  );
}

async function HomeRedirect(): Promise<never> {
  redirect((await getSessionClaims()) ? "/dashboard" : "/login");
}

function HomeLoading() {
  return (
    <main aria-busy="true" className="grid min-h-dvh place-items-center bg-background">
      <span role="status" className="sr-only">Opening your workspace</span>
      <LoaderCircle className="size-6 animate-spin text-muted-foreground" aria-hidden />
    </main>
  );
}
