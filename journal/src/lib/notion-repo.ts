import "server-only";
import { Client, isFullPage } from "@notionhq/client";
import type { Entry, EntryInput, Project, ProjectInput, Ref } from "./schema";
import type { Repo } from "./repo";

// Property names in the Notion "Journal Entries" database.
const P = {
  title: "Entry",
  type: "Type",
  status: "Status",
  tags: "Tags",
  category: "Category",
  project: "Project",
  people: "People",
  source: "Source",
  direction: "Direction",
  priority: "Priority",
  impact: "Impact",
  sentiment: "Sentiment",
  energy: "Energy",
  due: "Due",
  followUp: "Follow-up on",
  rationale: "Rationale",
  alternatives: "Alternatives considered",
  outcome: "Outcome",
  link: "Link",
  backdate: "Backdate",
  reviewed: "Reviewed",
  id: "ID",
  waitingOn: "Waiting on",
  stage: "Stage",
  reference: "Reference",
  amount: "Amount",
  chaseCount: "Chase count",
  lastChased: "Last chased",
} as const;

// Property names in the "Projects & Areas" database.
const PP = {
  name: "Name",
  kind: "Kind",
  state: "State",
  health: "Health",
  priority: "Priority",
  targetDate: "Target date",
  nextMilestone: "Next milestone",
  budget: "Budget",
  notes: "Notes",
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Props = Record<string, any>;

const plain = (rt: Array<{ plain_text: string }> | undefined) => (rt ?? []).map((t) => t.plain_text).join("");

function read(props: Props) {
  return {
    title: (name: string) => plain(props[name]?.title),
    text: (name: string) => plain(props[name]?.rich_text) || undefined,
    select: <T,>(name: string) => (props[name]?.select?.name as T | undefined) ?? undefined,
    status: <T,>(name: string) => (props[name]?.status?.name as T | undefined) ?? undefined,
    multi: (name: string) => ((props[name]?.multi_select ?? []) as Array<{ name: string }>).map((o) => o.name),
    relation: (name: string) => ((props[name]?.relation ?? []) as Array<{ id: string }>).map((r) => r.id),
    date: (name: string) => (props[name]?.date?.start as string | undefined) ?? undefined,
    checkbox: (name: string) => !!props[name]?.checkbox,
    url: (name: string) => (props[name]?.url as string | undefined) ?? undefined,
    number: (name: string) => (props[name]?.unique_id?.number as number | undefined) ?? undefined,
    num: (name: string) => (typeof props[name]?.number === "number" ? (props[name].number as number) : undefined),
  };
}

// Notion caps a rich text item at 2000 characters.
function richText(value: string) {
  const chunks = value.match(/[\s\S]{1,2000}/g) ?? [];
  return chunks.map((content) => ({ type: "text" as const, text: { content } }));
}

function paragraphs(body: string) {
  return body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 90)
    .map((line) => {
      const bullet = line.match(/^[-*•]\s+(.*)$/);
      return bullet
        ? { object: "block" as const, type: "bulleted_list_item" as const, bulleted_list_item: { rich_text: richText(bullet[1]) } }
        : { object: "block" as const, type: "paragraph" as const, paragraph: { rich_text: richText(line) } };
    });
}

function toEntry(page: { id: string; url: string; created_time: string; last_edited_time: string; properties: Props }): Entry {
  const r = read(page.properties);
  return {
    id: page.id,
    url: page.url,
    number: r.number(P.id),
    title: r.title(P.title) || "Untitled",
    type: r.select(P.type),
    status: r.status(P.status),
    tags: r.multi(P.tags),
    category: r.select(P.category),
    projectIds: r.relation(P.project),
    peopleIds: r.relation(P.people),
    source: r.select(P.source),
    direction: r.select(P.direction),
    priority: r.select(P.priority),
    impact: r.select(P.impact),
    sentiment: r.select(P.sentiment),
    energy: r.select(P.energy),
    due: r.date(P.due),
    followUp: r.date(P.followUp),
    rationale: r.text(P.rationale),
    alternatives: r.text(P.alternatives),
    outcome: r.text(P.outcome),
    link: r.url(P.link),
    backdate: r.date(P.backdate),
    waitingOn: r.select(P.waitingOn),
    stage: r.select(P.stage),
    reference: r.text(P.reference),
    amount: r.num(P.amount),
    chaseCount: r.num(P.chaseCount) ?? 0,
    lastChased: r.date(P.lastChased),
    reviewed: r.checkbox(P.reviewed),
    captured: page.created_time,
    lastEdited: page.last_edited_time,
  };
}

const sel = (v: string | null | undefined) => ({ select: v ? { name: v } : null });

function toProject(page: { id: string; url: string; properties: Props }): Project {
  const r = read(page.properties);
  return {
    id: page.id,
    url: page.url,
    name: r.title(PP.name) || "Untitled",
    kind: r.select(PP.kind),
    state: r.select(PP.state),
    health: r.select(PP.health),
    priority: r.select(PP.priority),
    targetDate: r.date(PP.targetDate),
    nextMilestone: r.text(PP.nextMilestone),
    budget: r.num(PP.budget),
    notes: r.text(PP.notes),
  };
}
const date = (v: string | null | undefined) => ({ date: v ? { start: v } : null });

export class NotionRepo implements Repo {
  readonly mode = "notion" as const;
  private client: Client;

  constructor(
    token: string,
    private ds: { entries: string; projects: string; people: string; briefParent: string },
  ) {
    this.client = new Client({ auth: token });
  }

  private async queryAll(dataSourceId: string) {
    const pages: Array<{ id: string; url: string; created_time: string; last_edited_time: string; properties: Props }> = [];
    let cursor: string | undefined;
    do {
      const res = await this.client.dataSources.query({
        data_source_id: dataSourceId,
        start_cursor: cursor,
        page_size: 100,
        sorts: [{ timestamp: "created_time", direction: "descending" }],
      });
      for (const p of res.results) if (isFullPage(p)) pages.push(p as never);
      cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
    } while (cursor);
    return pages;
  }

  async listEntries(): Promise<Entry[]> {
    return (await this.queryAll(this.ds.entries)).map(toEntry);
  }

  async getEntry(id: string) {
    const page = await this.client.pages.retrieve({ page_id: id });
    if (!isFullPage(page)) throw new Error("Entry not found");
    const blocks = await this.client.blocks.children.list({ block_id: id, page_size: 100 });
    const lines: string[] = [];
    for (const b of blocks.results as Array<Props>) {
      const rt = b[b.type]?.rich_text;
      if (!rt) continue;
      const text = plain(rt);
      if (b.type === "bulleted_list_item" || b.type === "numbered_list_item" || b.type === "to_do") lines.push(`- ${text}`);
      else if (b.type.startsWith("heading")) lines.push(`## ${text}`);
      else lines.push(text);
    }
    return { entry: toEntry(page as never), body: lines.join("\n") };
  }

  private async listRefs(dataSourceId: string): Promise<Ref[]> {
    return (await this.queryAll(dataSourceId)).map((p) => {
      const titleProp = Object.values(p.properties).find((v: Props) => v.type === "title") as Props | undefined;
      return { id: p.id, name: plain(titleProp?.title) || "Untitled" };
    });
  }

  listPeople() {
    return this.listRefs(this.ds.people);
  }
  async listProjects(): Promise<Project[]> {
    return (await this.queryAll(this.ds.projects)).map(toProject);
  }

  async updateProject(id: string, input: ProjectInput): Promise<void> {
    const props: Props = {};
    if (input.name !== undefined) props[PP.name] = { title: richText(input.name || "Untitled") };
    if (input.kind !== undefined) props[PP.kind] = sel(input.kind);
    if (input.state !== undefined) props[PP.state] = sel(input.state);
    if (input.health !== undefined) props[PP.health] = sel(input.health);
    if (input.priority !== undefined) props[PP.priority] = sel(input.priority);
    if (input.targetDate !== undefined) props[PP.targetDate] = date(input.targetDate);
    if (input.nextMilestone !== undefined) props[PP.nextMilestone] = { rich_text: richText(input.nextMilestone) };
    if (input.budget !== undefined) props[PP.budget] = { number: input.budget };
    if (input.notes !== undefined) props[PP.notes] = { rich_text: richText(input.notes) };
    if (Object.keys(props).length) await this.client.pages.update({ page_id: id, properties: props });
  }

  async createProject(input: ProjectInput): Promise<Project> {
    const page = await this.client.pages.create({
      parent: { type: "data_source_id", data_source_id: this.ds.projects },
      properties: { [PP.name]: { title: richText(input.name || "Untitled project") }, [PP.kind]: sel(input.kind ?? "Project"), [PP.state]: sel(input.state ?? "Active") },
    });
    await this.updateProject(page.id, { ...input, name: undefined, kind: undefined, state: undefined });
    const full = await this.client.pages.retrieve({ page_id: page.id });
    return toProject(full as never);
  }

  /** Writes the weekly brief as a page of to-dos under the Work Journal page. */
  async createBriefPage(title: string, sections: Array<{ heading: string; items: string[] }>): Promise<string> {
    const children = sections.flatMap((sec) => [
      { object: "block" as const, type: "heading_2" as const, heading_2: { rich_text: richText(sec.heading) } },
      ...(sec.items.length ? sec.items : ["Nothing here"]).slice(0, 40).map((t) => ({
        object: "block" as const,
        type: "to_do" as const,
        to_do: { rich_text: richText(t), checked: false },
      })),
    ]);
    const page = await this.client.pages.create({
      parent: { type: "page_id", page_id: this.ds.briefParent },
      icon: { type: "emoji", emoji: "🗓️" },
      properties: { title: { title: richText(title) } },
      children: children.slice(0, 100),
    });
    return (page as { url?: string }).url ?? "";
  }

  async createRef(kind: "people" | "projects", name: string): Promise<Ref> {
    const page = await this.client.pages.create({
      parent: { type: "data_source_id", data_source_id: kind === "people" ? this.ds.people : this.ds.projects },
      properties: { Name: { title: richText(name) } },
    });
    return { id: page.id, name };
  }

  private properties(input: EntryInput, projectIds?: string[], peopleIds?: string[]) {
    const props: Props = {};
    if (input.title !== undefined) props[P.title] = { title: richText(input.title || "Untitled") };
    if (input.type !== undefined) props[P.type] = sel(input.type);
    if (input.status !== undefined) props[P.status] = { status: { name: input.status } };
    if (input.tags !== undefined) props[P.tags] = { multi_select: input.tags.map((name) => ({ name: name.replace(/,/g, " ") })) };
    if (input.category !== undefined) props[P.category] = sel(input.category);
    if (projectIds) props[P.project] = { relation: projectIds.map((id) => ({ id })) };
    if (peopleIds) props[P.people] = { relation: peopleIds.map((id) => ({ id })) };
    if (input.source !== undefined) props[P.source] = sel(input.source);
    if (input.direction !== undefined) props[P.direction] = sel(input.direction);
    if (input.priority !== undefined) props[P.priority] = sel(input.priority);
    if (input.impact !== undefined) props[P.impact] = sel(input.impact);
    if (input.sentiment !== undefined) props[P.sentiment] = sel(input.sentiment);
    if (input.energy !== undefined) props[P.energy] = sel(input.energy);
    if (input.due !== undefined) props[P.due] = date(input.due);
    if (input.followUp !== undefined) props[P.followUp] = date(input.followUp);
    if (input.backdate !== undefined) props[P.backdate] = date(input.backdate);
    if (input.rationale !== undefined) props[P.rationale] = { rich_text: richText(input.rationale) };
    if (input.alternatives !== undefined) props[P.alternatives] = { rich_text: richText(input.alternatives) };
    if (input.outcome !== undefined) props[P.outcome] = { rich_text: richText(input.outcome) };
    if (input.link !== undefined) props[P.link] = { url: input.link || null };
    if (input.reviewed !== undefined) props[P.reviewed] = { checkbox: input.reviewed };
    if (input.waitingOn !== undefined) props[P.waitingOn] = sel(input.waitingOn);
    if (input.stage !== undefined) props[P.stage] = sel(input.stage);
    if (input.reference !== undefined) props[P.reference] = { rich_text: richText(input.reference) };
    if (input.amount !== undefined) props[P.amount] = { number: input.amount };
    if (input.chaseCount !== undefined) props[P.chaseCount] = { number: input.chaseCount };
    if (input.lastChased !== undefined) props[P.lastChased] = date(input.lastChased);
    return props;
  }

  async createEntry(input: EntryInput, projectIds: string[], peopleIds: string[]): Promise<Entry> {
    const page = await this.client.pages.create({
      parent: { type: "data_source_id", data_source_id: this.ds.entries },
      icon: undefined,
      properties: this.properties({ status: "Inbox", ...input }, projectIds, peopleIds),
      children: input.body ? paragraphs(input.body) : undefined,
    });
    if (!isFullPage(page)) throw new Error("Notion did not return the new page");
    return toEntry(page as never);
  }

  async updateEntry(id: string, input: EntryInput, projectIds?: string[], peopleIds?: string[]): Promise<void> {
    const props = this.properties(input, projectIds, peopleIds);
    if (Object.keys(props).length) await this.client.pages.update({ page_id: id, properties: props });
  }

  async appendNote(id: string, text: string): Promise<void> {
    await this.client.blocks.children.append({ block_id: id, children: paragraphs(text) });
  }

  async archiveEntry(id: string): Promise<void> {
    await this.client.pages.update({ page_id: id, in_trash: true });
  }
}
