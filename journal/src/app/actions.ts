"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as journal from "@/lib/journal";
import { SESSION_COOKIE, safeEqual, sessionToken } from "@/lib/auth";
import type { Entry, EntryInput, ProjectInput } from "@/lib/schema";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

function fail(err: unknown): { ok: false; error: string } {
  console.error(err);
  const message = err instanceof Error ? err.message : String(err);
  if (/unauthorized|restricted|could not find/i.test(message)) {
    return { ok: false, error: "Notion refused the request. Check NOTION_TOKEN and that the Work Journal page is shared with your integration." };
  }
  return { ok: false, error: message };
}

function refresh() {
  revalidatePath("/", "layout");
}

export async function captureAction(input: EntryInput): Promise<Result<Entry>> {
  try {
    if (!input.title?.trim()) return { ok: false, error: "Write something first." };
    const entry = await journal.createEntry({ type: "Note", ...input, title: input.title.trim().slice(0, 1900) });
    refresh();
    return { ok: true, data: entry };
  } catch (err) {
    return fail(err);
  }
}

export async function updateAction(id: string, input: EntryInput): Promise<Result> {
  try {
    await journal.updateEntry(id, input);
    refresh();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function appendNoteAction(id: string, text: string): Promise<Result> {
  try {
    if (!text.trim()) return { ok: false, error: "Note is empty." };
    await journal.appendNote(id, text.trim());
    refresh();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function archiveAction(id: string): Promise<Result> {
  try {
    await journal.archiveEntry(id);
    refresh();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function chaseAction(id: string, note?: string): Promise<Result> {
  try {
    await journal.chase(id, note);
    refresh();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function updateProjectAction(id: string, input: ProjectInput): Promise<Result> {
  try {
    await journal.updateProject(id, input);
    refresh();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function createProjectAction(input: ProjectInput): Promise<Result<{ id: string }>> {
  try {
    if (!input.name?.trim()) return { ok: false, error: "Give the project a name." };
    const p = await journal.createProject(input);
    refresh();
    return { ok: true, data: { id: p.id } };
  } catch (err) {
    return fail(err);
  }
}

export async function publishBriefAction(): Promise<Result<{ url: string }>> {
  try {
    const b = await journal.publishWeeklyBrief();
    return { ok: true, data: { url: b.url } };
  } catch (err) {
    return fail(err);
  }
}

/** Try a real read from Notion and report what happened in plain words. */
export async function testNotionAction(): Promise<Result<{ entries: number; projects: number; people: number }>> {
  if (!process.env.NOTION_TOKEN) return { ok: false, error: "NOTION_TOKEN is not set yet, so the app is using sample data." };
  try {
    const repo = journal.getRepo();
    const [entries, projects, people] = await Promise.all([repo.listEntries(), repo.listProjects(), repo.listPeople()]);
    return { ok: true, data: { entries: entries.length, projects: projects.length, people: people.length } };
  } catch (err) {
    return fail(err);
  }
}

export async function loginAction(_prev: { error?: string } | undefined, form: FormData): Promise<{ error?: string }> {
  const passcode = String(form.get("passcode") ?? "");
  const expected = process.env.APP_PASSCODE ?? "";
  // Small fixed delay blunts guessing.
  await new Promise((r) => setTimeout(r, 400));
  if (!expected || !safeEqual(passcode, expected)) return { error: "That passcode is not right." };
  (await cookies()).set(SESSION_COOKIE, await sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
  const next = String(form.get("next") ?? "/");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
