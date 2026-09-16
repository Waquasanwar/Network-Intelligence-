import type { SchedulingProviderKind } from "@prisma/client";
import type { SchedulingProvider } from "./types";
import { ManualSchedulingProvider } from "./manual";
import { MicrosoftGraphSchedulingProvider } from "./microsoft-graph";
import { CalendlySchedulingProvider } from "./calendly";

export function getSchedulingProvider(kind: SchedulingProviderKind, getToken?: () => Promise<string | null>): SchedulingProvider {
  switch (kind) {
    case "MICROSOFT_GRAPH":
      return new MicrosoftGraphSchedulingProvider(getToken);
    case "CALENDLY":
      return new CalendlySchedulingProvider(getToken);
    default:
      return new ManualSchedulingProvider();
  }
}

export function listSchedulingProviders(): SchedulingProvider[] {
  return [new MicrosoftGraphSchedulingProvider(), new CalendlySchedulingProvider(), new ManualSchedulingProvider()];
}

export * from "./types";
