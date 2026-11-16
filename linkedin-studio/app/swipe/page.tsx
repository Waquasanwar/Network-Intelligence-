import { Card, PageHeader } from "@/components/kit";
import { IdeaGenerator, SwipeForm, SwipeRating } from "@/components/swipe-tools";
import { Empty, fmtDate, SetupNeeded } from "@/components/ui";
import { aiReady, env, notionReady } from "@/lib/env";
import { listSwipe } from "@/lib/notion";

export const dynamic = "force-dynamic";

export default async function SwipePage() {
  if (!notionReady()) return <SetupNeeded />;
  const items = env.ds.swipe() ? await listSwipe() : [];
  return (
    <>
      <PageHeader
        eyebrow="Ideas"
        title="Ideas & swipe file"
        description="Post ideas drawn from what already works for you, and a library of other people’s posts worth learning from."
      />
      <Card accent title="What should I write next?" description="Ideas from your best-ranked posts and your 4★+ swipe file." className="mb">
        <IdeaGenerator enabled={aiReady()} />
      </Card>
      <div className="split">
        <Card flush title={`Swipe file · ${items.length}`} description="Posts that stopped you scrolling. Rate them so the assistant learns your taste.">
          {items.length ? (
            <div className="swipe-list">
              {items.map((s) => (
                <article key={s.id} className="swipe-item">
                  <div className="row between" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
                    <strong className="clamp">{s.title}</strong>
                    <SwipeRating id={s.id} value={s.rating} />
                  </div>
                  <div className="small faint">
                    {[s.author, s.hookType, fmtDate(s.createdAt)].filter(Boolean).join(" · ")}
                    {s.url ? (
                      <>
                        {" · "}
                        <a href={s.url} target="_blank" rel="noreferrer">source</a>
                      </>
                    ) : null}
                  </div>
                  {s.whyItWorks ? <div className="small"><b>Why it works:</b> {s.whyItWorks}</div> : null}
                  <details>
                    <summary className="small">Read post</summary>
                    <div className="preview small" style={{ marginTop: 8 }}>{s.text}</div>
                  </details>
                </article>
              ))}
            </div>
          ) : (
            <Empty>Save posts that stop you scrolling. Ones rated 4★+ teach the writing assistant your taste.</Empty>
          )}
        </Card>
        <Card title="Save a post" description="Paste it, say why it works, rate it.">
          <SwipeForm />
        </Card>
      </div>
    </>
  );
}
