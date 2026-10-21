import { LoadingSkeleton } from "@/components/shared/states";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-screen-2xl p-4 sm:p-6 lg:p-8">
      <LoadingSkeleton rows={6} cards={4} />
    </main>
  );
}
