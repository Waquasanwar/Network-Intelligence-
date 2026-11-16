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

export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const internal = isInternal(user);
  const [users, me, audit, deletionRequests] = await Promise.all([
    prisma.user.findMany({ where: { tenantId: user.tenantId }, orderBy: { name: "asc" } }),
    prisma.user.findUnique({ where: { id: user.id } }),
    prisma.auditLog.findMany({ where: { tenantId: user.tenantId, ...(sp.action ? { action: { startsWith: sp.action } } : {}) }, include: { actor: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.auditLog.findMany({ where: { tenantId: user.tenantId, action: { in: ["data.deletion_request", "person.export"] } }, include: { actor: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const canManage = user.role === "OWNER" || user.role === "ADMIN";
  const sensitive = ["identity.reveal", "introduction.approve", "summary.approve", "person.export", "user.role_change", "integration.connect", "integration.disconnect", "data.deletion_request", "auth.login"];

  return (
    <>
      <PageHeader title="Security" description="Identity, roles, audit and data-subject requests. Sensitive actions are always recorded." />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <Card>
            <CardHeader title="Users & roles" description="Server-side RBAC. Partners and clients live in their own tenants." />
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
                      {canManage && internal ? <td className="text-right">{u.id !== user.id ? <form action={changeUserRole} className="inline-flex items-center gap-1.5"><input type="hidden" name="userId" value={u.id} /><Select name="role" defaultValue={u.role} className="h-7 text-[12px] w-[130px]"><option value="OWNER">Owner</option><option value="ADMIN">Admin</option><option value="CONTRIBUTOR">Contributor</option></Select><SubmitButton size="sm" variant="secondary" pendingText="…">Set</SubmitButton></form> : <span className="text-[12px] text-ink-faint">you</span>}</td> : null}
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
              {audit.length === 0 ? <div className="px-6 pb-6"><EmptyState icon={ShieldCheck} title="Nothing logged yet" description="Sign-ins, record changes, exports and approvals appear here as they happen." /></div> : (
                <>
                  <table className="data">
                    <thead><tr><th className="pl-6">When</th><th>Who</th><th>Action</th><th>Record</th><th>Detail</th></tr></thead>
                    <tbody>{audit.slice(0, 10).map((a) => <tr key={a.id}><td className="pl-6 text-[13px] whitespace-nowrap text-ink-muted"><DateText date={a.createdAt} relative /></td><td className="text-[13px]">{a.actor?.name ?? "system"}</td><td><span className={`font-mono text-[12px] ${a.action === "identity.reveal" ? "text-amber font-medium" : ""}`}>{a.action}</span></td><td className="text-[13px] text-ink-muted">{a.entityType}</td><td className="text-[12px] text-ink-muted font-mono max-w-[260px] truncate">{a.metadata ? JSON.stringify(a.metadata) : ""}</td></tr>)}</tbody>
                  </table>
                  {audit.length > 10 ? (
                    <details className="group border-t border-line">
                      <summary className="flex items-center justify-between px-6 py-3 text-[13px] font-semibold text-ink cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:bg-surface-hover">Show {audit.length - 10} earlier entries <ChevronDown className="h-4 w-4 text-ink-faint transition-transform duration-200 group-open:rotate-180" /></summary>
                      <table className="data"><tbody>{audit.slice(10).map((a) => <tr key={a.id}><td className="pl-6 text-[13px] whitespace-nowrap text-ink-muted"><DateText date={a.createdAt} relative /></td><td className="text-[13px]">{a.actor?.name ?? "system"}</td><td><span className={`font-mono text-[12px] ${a.action === "identity.reveal" ? "text-amber font-medium" : ""}`}>{a.action}</span></td><td className="text-[13px] text-ink-muted">{a.entityType}</td><td className="text-[12px] text-ink-muted font-mono max-w-[260px] truncate">{a.metadata ? JSON.stringify(a.metadata) : ""}</td></tr>)}</tbody></table>
                    </details>
                  ) : null}
                </>
              )}
            </CardBody>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Your account" description="Sessions expire after 8 hours; signing out revokes the current session." />
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
