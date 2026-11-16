import { Editor } from "@/components/editor";
import { SetupNeeded } from "@/components/ui";
import { aiReady, notionReady } from "@/lib/env";
import { canPublish, getToken } from "@/lib/linkedin-api";
import { getPost, listPosts } from "@/lib/notion";
import { DEFAULT_PILLARS } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function WritePage({ searchParams }: { searchParams: Promise<{ id?: string; text?: string }> }) {
  if (!notionReady()) return <SetupNeeded />;
  const { id, text } = await searchParams;
  const [post, posts, token] = await Promise.all([id ? getPost(id) : null, listPosts(), getToken().catch(() => null)]);
  const pillars = [...new Set([...DEFAULT_PILLARS, ...posts.map((p) => p.pillar).filter((p): p is string => !!p)])];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{post ? "Edit post" : "Write"}</h1>
          <p className="muted">{post ? post.title : "Draft, check, rate, then post."}</p>
        </div>
      </div>
      <Editor key={post?.id ?? "new"} post={post} pillars={pillars} aiEnabled={aiReady()} canPublish={canPublish(token)} initialText={text} />
    </>
  );
}
