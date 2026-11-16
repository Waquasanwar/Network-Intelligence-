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
      <div className="page-head">
        <div>
          <h1>Ideas &amp; swipe file</h1>
          <p className="muted">Ideas drawn from what already works for you, and a library of other people&rsquo;s posts worth learning from.</p>
        </div>
      </div>
      <div className="panel" style={{ marginBottom: 16 }}>
        <h2>What should I write next?</h2>
        <IdeaGenerator enabled={aiReady()} />
      </div>
      <div className="split">
        <div className="stack">
          <h2 style={{ margin: "8px 0 0" }}>Swipe file <span className="faint">{items.length}</span></h2>
          {items.length ? (
            items.map((s) => (
              <div key={s.id} className="panel stack" style={{ gap: 6 }}>
                <div className="row between">
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
                <details>
                  <summary className="small">Read post</summary>
                  <div className="preview small" style={{ marginTop: 8 }}>{s.text}</div>
                </details>
                {s.whyItWorks ? <div className="small"><strong>Why it works:</strong> {s.whyItWorks}</div> : null}
              </div>
            ))
          ) : (
            <div className="panel"><Empty>Save posts that stop you scrolling. Ones rated 4★+ teach the writing assistant your taste.</Empty></div>
          )}
        </div>
        <div className="panel">
          <h2>Save a post</h2>
          <SwipeForm />
        </div>
      </div>
    </>
  );
}
