import { ChevronDown, ShieldCheck } from "lucide-react";
import { requireUser } from "@/server/session";
import { prisma } from "@/lib/db";
import { isInternal } from "@/lib/authz";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { changeUserRole } from "@/server/actions/settings";
import { MfaCard } from "@/components/domain/mfa-card";
import { DateText } from "@/components/domain/date";

export const metadata = { title: "Security" };

const SENSITIVE = ["identity.reveal", "introduction.approve", "summary.approve", "person.export", "user.role_change", "integration.connect", "integration.disconnect", "data.deletion_request", "auth.login", "auth.login_failed", "invite.create", "member.register"];

export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const internal = isInternal(user);
  // The directory, the audit trail and data requests belong to the internal team. A member,
  // partner or client reaching this page manages their own sign-in and nothing else.
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { mfaEnabled: true } });
  const [users, audit, deletionRequests] = internal
    ? await Promise.all([
        prisma.user.findMany({ where: { tenantId: user.tenantId, role: { in: ["OWNER", "ADMIN", "CONTRIBUTOR"] } }, select: { id: true, name: true, email: true, role: true, mfaEnabled: true, lastLoginAt: true }, orderBy: { name: "asc" } }),
        prisma.auditLog.findMany({ where: { tenantId: user.tenantId, ...(sp.action && SENSITIVE.includes(sp.action) ? { action: sp.action } : {}) }, include: { actor: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
        prisma.auditLog.findMany({ where: { tenantId: user.tenantId, action: { in: ["data.deletion_request", "person.export"] } }, include: { actor: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 20 }),
      ])
    : [[], [], []];
  const canManage = user.role === "OWNER" || user.role === "ADMIN";
  const isOwner = user.role === "OWNER";
  // Fee and commercial entries, and any amounts inside other entries, are shown to the owner only.
  const MONEY_KEYS = ["ourTake", "pct", "sharePct", "permPct", "contractMarginPct", "expertHourlyTakePct", "gross", "flat"];
  const detailOf = (a: { action: string; metadata: unknown }) => {
    if (isOwner || !a.metadata || typeof a.metadata !== "object") return a.metadata;
    return Object.fromEntries(Object.entries(a.metadata as Record<string, unknown>).filter(([k]) => !MONEY_KEYS.includes(k)));
  };
  const visibleAudit = isOwner ? audit : audit.filter((a) => !/^(fee\.|ratecard\.|brief\.terms|terms\.accept)/.test(a.action));
  const sensitive = SENSITIVE;

  if (!internal) {
    return (
      <div className="max-w-[560px] mx-auto">
        <PageHeader title="Sign-in security" description="Add a second step when you sign in. Your data and privacy choices are on your profile." />
        <Card>
          <CardHeader title="Your account" description="Sessions end after 8 hours. Turning on a second step protects your profile even if your password is guessed." />
          <CardBody><MfaCard enabled={!!me?.mfaEnabled} /></CardBody>
        </Card>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Security" description="Identity, roles, audit and data-subject requests. Sensitive actions are always recorded." />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <Card>
            <CardHeader title="Users & roles" description="Your internal team. Members, clients and agencies sign in to their own areas and are not listed here." />
            <CardBody className="px-0 pb-0">
              <table className="data">
                <thead><tr><th className="pl-4">User</th><th>Role</th><th>MFA</th><th>Last sign-in</th>{canManage && internal ? <th></th> : null}</tr></thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="pl-4"><div className="font-medium">{u.name}</div><div className="text-[12px] text-ink-faint">{u.email}</div></td>
                      <td><Badge tone={u.role === "OWNER" ? "navy" : "neutral"}>{u.role.toLowerCase()}</Badge></td>
                      <td>{u.mfaEnabled ? <Badge tone="teal">enabled</Badge> : <Badge tone="amber">off</Badge>}</td>
                      <td className="text-xs"><DateText date={u.lastLoginAt} relative /></td>
                      {canManage && internal ? <td className="text-right">{u.id !== user.id && (isOwner || u.role !== "OWNER") ? <form action={changeUserRole} className="inline-flex items-center gap-1.5"><input type="hidden" name="userId" value={u.id} /><Select name="role" defaultValue={u.role} className="h-7 text-[12px] w-[130px]">{isOwner ? <option value="OWNER">Owner</option> : null}<option value="ADMIN">Admin</option><option value="CONTRIBUTOR">Contributor</option></Select><SubmitButton size="sm" variant="secondary" pendingText="…">Set</SubmitButton></form> : <span className="text-[12px] text-ink-faint">you</span>}</td> : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Audit log" description="Login, record changes, exports, identity reveals, approvals, permission changes and integrations." action={
              <form className="flex items-center gap-1.5"><Select name="action" defaultValue={sp.action ?? ""} className="h-7 text-[12px] w-[180px]"><option value="">All actions</option>{sensitive.map((s) => <option key={s} value={s}>{s}</option>)}</Select><SubmitButton size="sm" variant="secondary" pendingText="…">Filter</SubmitButton></form>
            } />
            <CardBody className="px-0 pb-0">
              {visibleAudit.length === 0 ? <div className="px-6 pb-6"><EmptyState icon={ShieldCheck} title="Nothing logged yet" description="Sign-ins, record changes, exports and approvals appear here as they happen." /></div> : (
                <>
                  <table className="data">
                    <thead><tr><th className="pl-6">When</th><th>Who</th><th>Action</th><th>Record</th><th>Detail</th></tr></thead>
                    <tbody>{visibleAudit.slice(0, 10).map((a) => <tr key={a.id}><td className="pl-6 text-[13px] whitespace-nowrap text-ink-muted"><DateText date={a.createdAt} relative /></td><td className="text-[13px]">{a.actor?.name ?? "system"}</td><td><span className={`font-mono text-[12px] ${a.action === "identity.reveal" ? "text-amber font-medium" : ""}`}>{a.action}</span></td><td className="text-[13px] text-ink-muted">{a.entityType}</td><td className="text-[12px] text-ink-muted font-mono max-w-[260px] truncate">{a.metadata ? JSON.stringify(detailOf(a)) : ""}</td></tr>)}</tbody>
                  </table>
                  {visibleAudit.length > 10 ? (
                    <details className="group border-t border-line">
                      <summary className="flex items-center justify-between px-6 py-3 text-[13px] font-semibold text-ink cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:bg-surface-hover">Show {visibleAudit.length - 10} earlier entries <ChevronDown className="h-4 w-4 text-ink-faint transition-transform duration-200 group-open:rotate-180" /></summary>
                      <table className="data"><tbody>{visibleAudit.slice(10).map((a) => <tr key={a.id}><td className="pl-6 text-[13px] whitespace-nowrap text-ink-muted"><DateText date={a.createdAt} relative /></td><td className="text-[13px]">{a.actor?.name ?? "system"}</td><td><span className={`font-mono text-[12px] ${a.action === "identity.reveal" ? "text-amber font-medium" : ""}`}>{a.action}</span></td><td className="text-[13px] text-ink-muted">{a.entityType}</td><td className="text-[12px] text-ink-muted font-mono max-w-[260px] truncate">{a.metadata ? JSON.stringify(detailOf(a)) : ""}</td></tr>)}</tbody></table>
                    </details>
                  ) : null}
                </>
              )}
            </CardBody>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Your account" description="Sessions end after 8 hours. A role change signs that person out everywhere." />
            <CardBody>
              <MfaCard enabled={!!me?.mfaEnabled} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Session management" />
            <CardBody>
              <dl className="text-xs space-y-1">
                <div className="flex justify-between"><dt className="text-ink-faint">Strategy</dt><dd>Signed JWT, HttpOnly, SameSite=Lax</dd></div>
                <div className="flex justify-between"><dt className="text-ink-faint">Max age</dt><dd>8 hours</dd></div>
                <div className="flex justify-between"><dt className="text-ink-faint">Tenant</dt><dd>{user.tenantName}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-faint">Role</dt><dd>{user.role.toLowerCase()}</dd></div>
              </dl>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Retention & data requests" description="Export and deletion requests are logged; retention defaults below." />
            <CardBody>
              <dl className="text-xs space-y-1 mb-3">
                <div className="flex justify-between"><dt className="text-ink-faint">Conversation transcripts</dt><dd>24 months</dd></div>
                <div className="flex justify-between"><dt className="text-ink-faint">Audit log</dt><dd>7 years</dd></div>
                <div className="flex justify-between"><dt className="text-ink-faint">Inactive profiles</dt><dd>Review at 36 months</dd></div>
              </dl>
              <div className="label-caps text-ink-faint mb-1">Recent requests</div>
              {deletionRequests.length === 0 ? <div className="text-xs text-ink-faint">None.</div> : <ul className="text-xs space-y-1">{deletionRequests.map((r) => <li key={r.id} className="flex justify-between gap-2"><span className="font-mono text-[12px]">{r.action}</span><DateText date={r.createdAt} relative className="text-ink-faint" /></li>)}</ul>}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
