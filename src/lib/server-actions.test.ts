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

  it("every action file re-authorises: it imports a requireUser/requireInternal guard", () => {
    for (const file of files) {
      const src = readFileSync(join(ACTION_DIR, file), "utf8");
      if (!src.includes('"use server"')) continue;
      expect(/require(User|Internal|InternalAction)/.test(src), `${file} imports no auth guard`).toBe(true);
    }
  });
});
