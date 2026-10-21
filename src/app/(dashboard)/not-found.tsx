import Link from "next/link";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return <EmptyState title="We can’t find that record" description="It may have been removed, or it belongs to another employee." action={<Button asChild><Link href="/dashboard">Back to dashboard</Link></Button>} />;
}
