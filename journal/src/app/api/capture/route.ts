import { captureText } from "@/lib/journal";
import { apiAuthorized, unauthorized } from "@/lib/api-auth";

// POST /api/capture   Authorization: Bearer <CAPTURE_TOKEN>
// Body: {"text": "r: send Q4 numbers to @Sarah due:fri"}  or plain text.
// Same shorthand as the app. Use it from iOS Shortcuts, Raycast, Alfred, Zapier or curl.
export async function POST(req: Request) {
  if (!apiAuthorized(req)) return unauthorized();
  let text = "";
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as { text?: unknown };
    text = typeof body.text === "string" ? body.text : "";
  } else {
    text = await req.text();
  }
  text = text.trim().slice(0, 5000);
  if (!text) return Response.json({ error: "Send some text." }, { status: 400 });
  try {
    const entry = await captureText(text);
    return Response.json({ ok: true, id: entry.id, title: entry.title, type: entry.type, url: entry.url }, { status: 201 });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Could not save to Notion." }, { status: 502 });
  }
}
