import { Card, Chip, PageHeader } from "@/components/kit";
import { disconnectLinkedIn } from "@/app/actions";
import { fmtDate } from "@/components/ui";
import { aiReady, env, linkedinReady, notionReady } from "@/lib/env";
import { canPublish, canReadAnalytics, getToken, redirectUri } from "@/lib/linkedin-api";

export const dynamic = "force-dynamic";

function Item({ ok, title, children }: { ok: boolean; title: string; children: React.ReactNode }) {
  return (
    <Card title={title} action={<Chip tone={ok ? "up" : "down"}>{ok ? "✓ Ready" : "Not set up"}</Chip>}>
      <div className="small prose">{children}</div>
    </Card>
  );
}

export default async function ConnectPage({ searchParams }: { searchParams: Promise<{ error?: string; connected?: string }> }) {
  const { error, connected } = await searchParams;
  const token = notionReady() ? await getToken().catch(() => null) : null;

  return (
    <>
      <PageHeader eyebrow="Setup" title="Connect & setup" description="What’s connected, and what each connection unlocks." />
      {error ? <div className="notice warn" style={{ marginBottom: 16 }}>LinkedIn: {error}</div> : null}
      {connected ? <div className="notice" style={{ marginBottom: 16 }}>LinkedIn connected.</div> : null}

      <div className="stack" style={{ gap: "var(--gap)", maxWidth: 820 }}>
        <Item ok={notionReady()} title="Notion (required)">
          <p>The database for everything: posts, ratings, metric snapshots, daily metrics, swipe file.</p>
          {!notionReady() ? (
            <p>Set <code>NOTION_TOKEN</code> and <code>NOTION_PARENT_PAGE_ID</code>, then run <code>npm run setup:notion</code>.</p>
          ) : (
            <p className="muted">Databases: posts, snapshots{env.ds.daily() ? ", daily metrics" : ""}{env.ds.swipe() ? ", swipe file" : ""}{env.ds.config() ? ", config" : ""}.</p>
          )}
        </Item>

        <Item ok={aiReady()} title="Writing assistant (Claude)">
          <p>Scores drafts against your own best and worst posts, writes alternative hooks, rewrites on request, and suggests what to write next.</p>
          {!aiReady() ? <p>Set <code>ANTHROPIC_API_KEY</code>.</p> : null}
        </Item>

        <Item ok={Boolean(token)} title="LinkedIn">
          {token ? (
            <>
              <p>
                Connected as <strong>{token.name || token.memberId}</strong>. Token expires {fmtDate(new Date(token.expiresAt).toISOString())}
                {token.refreshToken ? " (refreshes automatically)" : ". LinkedIn tokens last 60 days; reconnect when it expires"}.
              </p>
              <ul style={{ margin: "4px 0", paddingLeft: 18 }}>
                <li>Publish from the editor: {canPublish(token) ? "yes" : "no (needs w_member_social)"}</li>
                <li>Pull post analytics daily: {canReadAnalytics(token) ? "yes" : "not yet (needs r_member_postAnalytics, see below)"}</li>
              </ul>
              <div className="row">
                <a className="btn" href="/api/linkedin/auth">Reconnect</a>
                <form action={disconnectLinkedIn}><button className="btn ghost">Disconnect</button></form>
              </div>
            </>
          ) : linkedinReady() && notionReady() ? (
            <>
              <p>Sign in with LinkedIn to publish from the editor and, once approved, pull analytics automatically.</p>
              <div><a className="btn primary" href="/api/linkedin/auth">Connect LinkedIn</a></div>
            </>
          ) : (
            <p>Set <code>LINKEDIN_CLIENT_ID</code>, <code>LINKEDIN_CLIENT_SECRET</code> and <code>APP_SECRET</code> (see below).</p>
          )}
          <details style={{ marginTop: 8 }}>
            <summary>How to set up the LinkedIn app</summary>
            <ol style={{ paddingLeft: 18 }}>
              <li>
                Create an app at <a href="https://www.linkedin.com/developers/apps">linkedin.com/developers/apps</a>. LinkedIn asks you to link a Company Page; your own page works.
              </li>
              <li>Under <em>Products</em>, add <strong>Sign In with LinkedIn using OpenID Connect</strong> and <strong>Share on LinkedIn</strong>. Both are instant.</li>
              <li>
                Under <em>Auth</em>, add this redirect URL: <code>{redirectUri()}</code>
              </li>
              <li>Copy the client ID and secret into <code>.env</code>, set a random <code>APP_SECRET</code>, restart, then click Connect.</li>
              <li>
                For automatic analytics, request the <strong>Community Management API</strong> on the same app. LinkedIn reviews it (it asks for a registered business and a use-case description). Once approved, add <code>r_member_postAnalytics</code> to <code>LINKEDIN_SCOPES</code> and reconnect.
              </li>
            </ol>
          </details>
        </Item>

        <Item ok={Boolean(env.cronSecret())} title="Daily sync">
          <p>
            Pulls analytics for every published post, saves a snapshot so you can see how each post grows, records account totals by day, and re-ranks everything. Runs at 06:17 UTC on
            Vercel (see <code>vercel.json</code>), or run <code>npm run sync</code> from any scheduler.
          </p>
          {!env.cronSecret() ? <p>Set <code>CRON_SECRET</code> to protect the endpoint.</p> : null}
        </Item>
      </div>
    </>
  );
}
