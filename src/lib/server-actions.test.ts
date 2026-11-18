/**
 * A "use server" file exposes every one of its exports as a public POST endpoint that any
 * authenticated client can invoke with arguments it controls. So an exported function that
 * *trusts* an argument — a SessionUser, a bare tenantId it does not re-authorise — is a
 * cross-tenant data leak, not a helper. This test enforces the rule across the whole action
 * surface, so the mistake cannot be reintroduced by a later edit.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ACTION_DIR = join(process.cwd(), "src/server/actions");

const exportedFns = (src: string) =>
  [...src.matchAll(/export async function (\w+)\s*\(([^)]*)\)/g)].map((m) => ({ name: m[1], args: m[2] }));

describe("server-action surface", () => {
  const files = readdirSync(ACTION_DIR).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

  it("has files to check", () => expect(files.length).toBeGreaterThan(0));

  it.each(files)("%s: no export trusts a caller-supplied SessionUser", (file) => {
    const src = readFileSync(join(ACTION_DIR, file), "utf8");
    if (!src.includes('"use server"')) return;
    const offenders = exportedFns(src).filter((f) => /SessionUser/.test(f.args));
    expect(offenders.map((f) => f.name), `${file} exports action(s) that trust a passed-in user`).toEqual([]);
  });

  it.each(files)("%s: no export takes only a bare tenantId as its trust boundary", (file) => {
    const src = readFileSync(join(ACTION_DIR, file), "utf8");
    if (!src.includes('"use server"')) return;
    // A single string param literally named tenantId means the caller chooses the tenant.
    const offenders = exportedFns(src).filter((f) => /^\s*tenantId\s*:\s*string\s*$/.test(f.args));
    expect(offenders.map((f) => f.name), `${file} exports action(s) keyed on a client-supplied tenantId`).toEqual([]);
  });

  /**
   * The few actions that are deliberately reachable without a session, each with the protection
   * that stands in for one. Adding a name here is a security decision and should read like one.
   */
  const PUBLIC: Record<string, RegExp[]> = {
    // Joining: the encrypted invitation decides the tenant, and the endpoint is throttled.
    registerMember: [/resolveInvite\(/, /rateLimit\("join"/],
    enrichSelfDraft: [/resolveInvite\(/, /rateLimit\("join"/],
    // The public page's two forms. The network is fixed on the server, never taken from the caller,
    // and each is throttled per connection before anything is read or stored.
    applyToJoin: [/publicNetwork\(/, /rateLimit\("join"/],
    sendNeed: [/publicNetwork\(/, /rateLimit\("join"/],
    // A referee has no login. The sealed, single-use link decides which request it is, and the
    // endpoint is throttled. It can only add one reference to the one person the link was made for.
    answerReference: [/readReference\(/, /rateLimit\("join"/],
    // Signing out needs no permission; it only ever ends the caller's own session.
    signOutAction: [/signOut\(/],
  };
  const GUARD = /\b(requireUser|requireInternal|requireInternalAction|requireAdminAction|requireOwnerAction)\(/;

  /** The source of each exported action, from its declaration to the next export. */
  const bodies = (src: string) => {
    const starts = [...src.matchAll(/^export async function (\w+)/gm)].map((m) => ({ name: m[1], at: m.index! }));
    const ends = [...src.matchAll(/^export /gm)].map((m) => m.index!);
    return starts.map((f) => ({ name: f.name, body: src.slice(f.at, ends.find((e) => e > f.at) ?? src.length) }));
  };

  it.each(files)("%s: every exported action authenticates its caller itself", (file) => {
    const src = readFileSync(join(ACTION_DIR, file), "utf8");
    if (!src.includes('"use server"')) return;
    for (const f of bodies(src)) {
      if (PUBLIC[f.name]) {
        for (const needed of PUBLIC[f.name]) expect(needed.test(f.body), `${file}: public action ${f.name} must contain ${needed}`).toBe(true);
        continue;
      }
      expect(GUARD.test(f.body), `${file}: ${f.name} is a public endpoint and does not call an auth guard`).toBe(true);
    }
  });

  it("fees, commercial terms and the rate card can only be changed by the owner", () => {
    const owner: Record<string, string[]> = { "demand.ts": ["saveBriefTerms", "setFeeStatus", "addFeeLine", "saveRateCard"], "partners.ts": ["updatePartner"] };
    for (const [file, names] of Object.entries(owner)) {
      const all = bodies(readFileSync(join(ACTION_DIR, file), "utf8"));
      for (const n of names) expect(/requireOwnerAction\(/.test(all.find((f) => f.name === n)?.body ?? ""), `${file}: ${n} must require the owner`).toBe(true);
    }
  });

  it("only async functions are exported from action files (nothing else becomes an endpoint by accident)", () => {
    for (const file of files) {
      const src = readFileSync(join(ACTION_DIR, file), "utf8");
      if (!src.includes('"use server"')) continue;
      const other = [...src.matchAll(/^export (?!async function |type |interface )(.*)$/gm)].map((m) => m[1].slice(0, 40));
      expect(other, `${file} exports something other than an async action or a type`).toEqual([]);
    }
  });
});
