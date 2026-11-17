import { headers } from "next/headers";
import { setupChecks } from "@/lib/setup";
import { mode } from "@/lib/journal";
import { StartGuide } from "@/components/StartGuide";

export const dynamic = "force-dynamic";

export default async function StartPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3100";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return <StartGuide checks={setupChecks()} mode={mode()} origin={`${proto}://${host}`} />;
}
