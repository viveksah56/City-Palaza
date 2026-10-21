import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: light)", color: "#ffffff" }, { media: "(prefers-color-scheme: dark)", color: "#09090b" }], viewportFit: "cover" };


export const metadata: Metadata = {
  title: { default: "CityPalaza", template: "%s · CityPalaza" },
  description: "Stock and sales management for CityPalaza mobile & electronics shop",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('citypalaza-theme');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t}}catch{}` }} />
      </head>
      <body className="min-h-dvh antialiased">
        <TooltipProvider delayDuration={450} skipDelayDuration={150}>
          {children}
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
