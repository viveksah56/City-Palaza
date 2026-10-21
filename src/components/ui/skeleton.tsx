import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" className={cn("relative overflow-hidden rounded-xl bg-secondary before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.6s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent dark:before:via-white/5", className)} {...props} />;
}

export { Skeleton };
