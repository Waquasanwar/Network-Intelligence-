import { redirect } from "next/navigation";
export default async function CaptureRedirect({ searchParams }: { searchParams: Promise<{ personId?: string }> }) {
  const { personId } = await searchParams;
  redirect(personId ? `/network/${personId}?tab=conversations` : "/conversations");
}
