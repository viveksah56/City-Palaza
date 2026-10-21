"use client";

export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", colorScheme: "light dark", background: "Canvas", color: "CanvasText", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ boxSizing: "border-box", display: "grid", minHeight: "100vh", placeContent: "center", padding: "2rem", textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: "1.5rem", letterSpacing: "-0.03em" }}>CityPalaza could not load</h1>
          <p style={{ maxWidth: "30rem", margin: "0.75rem auto 1.5rem", lineHeight: 1.6, opacity: 0.72 }}>A temporary problem stopped the application from starting. Try again to reload your workspace.</p>
          <button onClick={retry} style={{ justifySelf: "center", border: "1px solid color-mix(in srgb, CanvasText 16%, transparent)", borderRadius: "0.625rem", padding: "0.65rem 1rem", background: "CanvasText", color: "Canvas", font: "inherit", fontWeight: 600, cursor: "pointer" }}>Try again</button>
        </main>
      </body>
    </html>
  );
}
