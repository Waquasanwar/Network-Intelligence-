import "server-only";

export interface SetupCheck {
  key: string;
  label: string;
  done: boolean;
  why: string;
}

/** Which settings are in place. Only booleans leave the server; never the values. */
export function setupChecks(): SetupCheck[] {
  const e = process.env;
  const secret = e.AUTH_SECRET ?? "";
  return [
    { key: "NOTION_TOKEN", label: "Notion connected", done: !!e.NOTION_TOKEN, why: "Saves everything to your Work Journal in Notion instead of sample data." },
    { key: "APP_PASSCODE", label: "Passcode set", done: !!e.APP_PASSCODE, why: "Keeps your journal private. Required before the app will serve Notion data online." },
    { key: "AUTH_SECRET", label: "Sign-in secret set", done: secret.length >= 24 && secret !== "change-me", why: "Signs the sign-in cookie so it cannot be forged." },
    { key: "JOURNAL_TIMEZONE", label: "Timezone set", done: !!e.JOURNAL_TIMEZONE, why: "So the Monday brief lands at 9am your time and \"tomorrow\" means your tomorrow." },
    { key: "CRON_SECRET", label: "Monday brief scheduled", done: !!e.CRON_SECRET, why: "Lets Vercel run the 9am Monday brief, and nobody else." },
    { key: "CAPTURE_TOKEN", label: "Phone shortcut enabled", done: !!e.CAPTURE_TOKEN, why: "Lets an iPhone Shortcut, Siri or Raycast add entries without opening the app." },
  ];
}
