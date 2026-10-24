import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: light)", color: "rgb(255 255 255)" }, { media: "(prefers-color-scheme: dark)", color: "rgb(20 20 23)" }], viewportFit: "cover" };


export const metadata: Metadata = {
  title: { default: "CityPlaza", template: "%s · CityPlaza" },
  description: "Stock and sales management for CityPlaza mobile & electronics shop",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem storageKey="citypalaza-theme" disableTransitionOnChange>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
