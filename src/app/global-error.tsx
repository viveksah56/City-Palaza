"use client";

import { useEffect, useState } from "react";
import "./globals.css";

export default function GlobalError({
    error,
    retry,
}: {
    error: Error & { digest?: string };
    retry: () => void;
}) {
    const [retrying, setRetrying] = useState(false);

    useEffect(() => {
        console.error(error);
        setRetrying(false);
    }, [error]);

    const handleRetry = () => {
        setRetrying(true);
        retry();
    };

    return (
        <html lang="en">
            <head>
                <title>Something went wrong | CityPlaza</title>
                <meta name="robots" content="noindex" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <style>{`
                    @keyframes ge-fade-up {
                        from { opacity: 0; transform: translateY(18px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    @keyframes ge-float {
                        0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
                        50% { transform: translate3d(30px, -24px, 0) scale(1.08); }
                    }
                    @keyframes ge-ring {
                        0% { transform: scale(0.85); opacity: 0.55; }
                        100% { transform: scale(1.7); opacity: 0; }
                    }
                    @keyframes ge-bob {
                        0%, 100% { transform: translateY(0); }
                        50% { transform: translateY(-5px); }
                    }
                `}</style>
            </head>
            <body className="m-0 min-h-screen overflow-x-hidden bg-neutral-50 font-sans text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-50">
                <div
                    aria-hidden="true"
                    className="pointer-events-none fixed inset-0 overflow-hidden"
                >
                    <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-indigo-400/30 blur-3xl animate-[ge-float_14s_ease-in-out_infinite] motion-reduce:animate-none sm:h-96 sm:w-96 dark:bg-indigo-500/25" />
                    <div className="absolute -bottom-28 -right-20 h-72 w-72 rounded-full bg-fuchsia-400/25 blur-3xl animate-[ge-float_18s_ease-in-out_infinite_reverse] motion-reduce:animate-none sm:h-96 sm:w-96 dark:bg-fuchsia-500/20" />
                    <div className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-300/20 blur-3xl sm:h-80 sm:w-80 dark:bg-sky-500/10" />
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.04)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)]" />
                </div>

                <main
                    role="alert"
                    className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-8"
                >
                    <section className="w-full max-w-md rounded-3xl border border-black/5 bg-white/70 p-6 text-center shadow-[0_20px_60px_-15px_rgba(79,70,229,0.25)] backdrop-blur-xl animate-[ge-fade-up_0.8s_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none sm:max-w-lg sm:p-10 md:max-w-xl md:p-12 dark:border-white/10 dark:bg-white/5 dark:shadow-[0_20px_60px_-15px_rgba(99,102,241,0.35)]">
                        <div
                            className="relative mx-auto mb-6 flex h-16 w-16 items-center justify-center sm:mb-8 sm:h-20 sm:w-20 animate-[ge-fade-up_0.8s_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none"
                            style={{ animationDelay: "100ms" }}
                        >
                            <span className="absolute inset-0 rounded-full bg-indigo-500/30 animate-[ge-ring_2.4s_ease-out_infinite] motion-reduce:animate-none" />
                            <span
                                className="absolute inset-0 rounded-full bg-indigo-500/20 animate-[ge-ring_2.4s_ease-out_infinite] motion-reduce:animate-none"
                                style={{ animationDelay: "1.2s" }}
                            />
                            <span className="relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/40 animate-[ge-bob_3.5s_ease-in-out_infinite] motion-reduce:animate-none">
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-7 w-7 sm:h-9 sm:w-9"
                                    aria-hidden="true"
                                >
                                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                                    <path d="M12 9v4" />
                                    <path d="M12 17h.01" />
                                </svg>
                            </span>
                        </div>

                        <p
                            className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600 animate-[ge-fade-up_0.8s_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none dark:text-indigo-400"
                            style={{ animationDelay: "180ms" }}
                        >
                            Unexpected error
                        </p>

                        <h1
                            className="m-0 bg-gradient-to-br from-neutral-900 via-neutral-800 to-indigo-700 bg-clip-text text-2xl font-bold leading-tight tracking-tight text-transparent animate-[ge-fade-up_0.8s_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none sm:text-3xl md:text-4xl dark:from-white dark:via-neutral-100 dark:to-indigo-300"
                            style={{ animationDelay: "260ms" }}
                        >
                            CityPlaza could not load
                        </h1>

                        <p
                            className="mx-auto mb-8 mt-4 max-w-sm text-sm leading-relaxed text-neutral-600 animate-[ge-fade-up_0.8s_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none sm:max-w-md sm:text-base dark:text-neutral-400"
                            style={{ animationDelay: "340ms" }}
                        >
                            A temporary problem stopped the application from starting. Try
                            again to reload your workspace.
                        </p>

                        <div
                            className="flex flex-col gap-3 animate-[ge-fade-up_0.8s_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none sm:flex-row sm:justify-center"
                            style={{ animationDelay: "420ms" }}
                        >
                            <button
                                type="button"
                                onClick={handleRetry}
                                disabled={retrying}
                                className="group relative inline-flex w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-500 active:translate-y-0 active:scale-[0.98] disabled:cursor-wait disabled:opacity-80 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:w-auto sm:text-base"
                            >
                                <span
                                    aria-hidden="true"
                                    className="absolute inset-y-0 -left-full w-full -skew-x-12 bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-[200%] motion-reduce:hidden"
                                />
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className={`relative h-4 w-4 transition-transform duration-500 group-hover:rotate-180 motion-reduce:transition-none ${retrying ? "animate-spin" : ""}`}
                                    aria-hidden="true"
                                >
                                    <path d="M21 12a9 9 0 1 1-3-6.7" />
                                    <path d="M21 3v6h-6" />
                                </svg>
                                <span className="relative">
                                    {retrying ? "Retrying..." : "Try again"}
                                </span>
                            </button>

                            <a
                                href="/"
                                className="inline-flex w-full items-center justify-center rounded-xl border border-neutral-900/10 bg-white/60 px-6 py-3 text-sm font-semibold text-neutral-800 backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-500 active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:w-auto sm:text-base dark:border-white/10 dark:bg-white/5 dark:text-neutral-100 dark:hover:bg-white/10"
                            >
                                Back to home
                            </a>
                        </div>

                        {error.digest && (
                            <p
                                className="mt-8 break-all text-xs text-neutral-500 animate-[ge-fade-up_0.8s_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none dark:text-neutral-500"
                                style={{ animationDelay: "500ms" }}
                            >
                                Error reference:{" "}
                                <span className="rounded-md bg-neutral-900/5 px-1.5 py-0.5 font-mono dark:bg-white/10">
                                    {error.digest}
                                </span>
                            </p>
                        )}
                    </section>
                </main>
            </body>
        </html>
    );
}