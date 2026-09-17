"use client";
import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { previewImport, commitImport, type ImportPreview, type ImportResult } from "@/server/actions/import";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, Chip } from "@/components/ui/badge";
import { Field, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { SOURCE_LABELS, RELATIONSHIP_LABELS } from "@/lib/labels";
import { Download, FileUp, CheckCircle2 } from "lucide-react";

export function ImportWizard() {
  const [preview, runPreview] = useActionState(previewImport, null as ImportPreview | null);
  const [result, runCommit] = useActionState(commitImport, null as ImportResult | null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);

  if (result?.ok) {
    return (
      <Card className="max-w-2xl">
        <CardBody className="pt-6 pb-6 text-center">
          <CheckCircle2 className="h-8 w-8 text-teal mx-auto" />
          <h2 className="text-[16px] font-semibold mt-3">Imported {result.created} {result.created === 1 ? "person" : "people"}</h2>
          <p className="text-[13px] text-ink-muted mt-1">
            {result.skipped ? `${result.skipped} skipped (blocked or already in the network). ` : ""}
            {result.linkedIntroducers ? `${result.linkedIntroducers} introducer link${result.linkedIntroducers === 1 ? "" : "s"} recorded. ` : ""}
            Everyone starts as &ldquo;Needs refresh&rdquo; and appears in your reconnect queue until you have had a conversation.
          </p>
          <div className="flex justify-center gap-2 mt-5">
            <Link href="/network"><Button>Open the network</Button></Link>
            <Link href="/network/import"><Button variant="secondary">Import another file</Button></Link>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-4 items-start">
      <div className="space-y-4">
        <Card>
          <CardHeader title="1. Get the template" description="Or use your own headers. Names are required; everything else is optional." action={<a href="/api/import/template" download><Button variant="secondary" size="sm"><Download className="h-3.5 w-3.5" /> Template</Button></a>} />
          <CardBody>
            <div className="text-[12px] text-ink-muted leading-5">
              Recognised columns: <span className="text-ink">first_name, last_name</span>, email, phone, headline, company, role, city, country, capabilities, sectors, linkedin, source, relationship, introduced_by, worked_together, notes.
              Separate multiple capabilities with semicolons. &ldquo;introduced_by&rdquo; links to a person by name, in this file or already in the network.
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="2. Upload or paste" description="CSV, or rows copied straight out of Excel or Google Sheets." />
          <CardBody>
            <form action={runPreview} className="space-y-4">
              <label className="block rounded-lg border border-dashed border-line-strong bg-surface-muted/50 px-4 py-6 text-center cursor-pointer hover:border-navy/40 transition-colors">
                <input ref={fileRef} type="file" name="file" accept=".csv,.tsv,text/csv,text/tab-separated-values,text/plain" className="sr-only" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)} />
                <FileUp className="h-5 w-5 text-ink-faint mx-auto" />
                <div className="text-[13px] font-medium mt-2">{fileName ?? "Choose a CSV file"}</div>
                <div className="text-[11.5px] text-ink-faint mt-0.5">Up to 2 MB, 2,000 rows per import</div>
              </label>
              <div className="text-center text-[11px] text-ink-faint">or</div>
              <Field label="Paste rows" hint="Include the header row. Tabs or commas both work."><Textarea name="text" className="min-h-[110px] mono" placeholder={"first_name,last_name,email,company,capabilities\nSarah,Okonkwo,sarah@example.com,Independent,Programme director; Turnaround"} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Default source" hint="Used when a row has no source"><Select name="defaultSource" defaultValue="PERSONAL_NETWORK">{Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
                <Field label="Default relationship" hint="Used when a row has none"><Select name="defaultRelationship" defaultValue="DIRECT">{Object.entries(RELATIONSHIP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
              </div>
              <SubmitButton className="w-full" pendingText="Checking rows…">Preview import</SubmitButton>
            </form>
          </CardBody>
        </Card>
      </div>

      <div>
        {!preview ? (
          <div className="rounded-lg border border-dashed border-line-strong px-6 py-16 text-center bg-surface/60">
            <div className="text-[13px] font-medium">Preview appears here</div>
            <div className="text-[12.5px] text-ink-muted mt-1">Nothing is written until you confirm. Rows with problems are shown, not silently dropped.</div>
          </div>
        ) : !preview.ok ? (
          <div className="rounded-lg border border-amber/30 bg-amber-50 px-4 py-3 text-[13px] text-ink"><span className="font-medium text-amber">Could not read the file.</span> {preview.error}</div>
        ) : (
          <Card>
            <CardHeader
              title="3. Check and confirm"
              description={`${preview.totals.total} rows · ${preview.totals.ready} ready · ${preview.totals.duplicates} already in the network · ${preview.totals.blocked} need a fix`}
              action={
                <form action={runCommit}>
                  <input type="hidden" name="rows" value={JSON.stringify(preview.rows)} />
                  <SubmitButton variant="teal" disabled={preview.totals.ready === 0} pendingText="Importing…">Import {preview.totals.ready} {preview.totals.ready === 1 ? "person" : "people"}</SubmitButton>
                </form>
              }
            />
            <CardBody className="px-0 pb-0">
              {result && !result.ok ? <div className="mx-4 mb-3 rounded-md border border-risk/25 bg-risk-100 px-3 py-2 text-[12.5px] text-risk">{result.error}</div> : null}
              {preview.unknownHeaders.length ? <div className="mx-4 mb-3 text-[12px] text-ink-muted">Ignored columns: {preview.unknownHeaders.map((h) => <Chip key={h} className="ml-1">{h}</Chip>)}</div> : null}
              <div className="max-h-[70vh] overflow-auto">
                <table className="data">
                  <thead><tr><th className="pl-4">#</th><th>Person</th><th>Company · role</th><th>Location</th><th>Capabilities</th><th>Provenance</th><th>Status</th></tr></thead>
                  <tbody>
                    {preview.rows.map((r) => {
                      const state = r.issues.length ? "blocked" : r.duplicateOf && r.duplicateOf !== "file" ? "duplicate" : "ready";
                      return (
                        <tr key={r.line} className={state === "blocked" ? "bg-amber-50/40" : state === "duplicate" ? "opacity-60" : ""}>
                          <td className="pl-4 text-ink-faint tabular text-[12px]">{r.line}</td>
                          <td><div className="font-medium">{r.firstName} {r.lastName}</div><div className="text-[11.5px] text-ink-faint mono">{r.email ?? ""}</div></td>
                          <td className="text-[12.5px] text-ink-muted">{[r.role, r.company].filter(Boolean).join(" · ") || "—"}</td>
                          <td className="text-[12.5px] text-ink-muted">{[r.city, r.country].filter(Boolean).join(", ") || "—"}</td>
                          <td><div className="flex flex-wrap gap-1 max-w-[220px]">{r.capabilities.slice(0, 3).map((c) => <Chip key={c}>{c}</Chip>)}{r.capabilities.length > 3 ? <span className="text-[11px] text-ink-faint">+{r.capabilities.length - 3}</span> : null}</div></td>
                          <td className="text-[12px] text-ink-muted">{SOURCE_LABELS[r.source]} · {RELATIONSHIP_LABELS[r.relationship]}{r.introducedBy ? <div className="text-[11.5px] text-ink-faint">via {r.introducedBy}</div> : null}{r.workedTogether ? <div className="text-[11.5px] text-teal">worked together</div> : null}</td>
                          <td>
                            {state === "ready" ? <Badge tone="teal">Ready</Badge> : state === "duplicate" ? <Badge tone="neutral">Already added</Badge> : <Badge tone="amber">Needs a fix</Badge>}
                            {r.issues.map((i) => <div key={i} className="text-[11.5px] text-amber mt-0.5">{i}</div>)}
                            {r.warnings.map((w) => <div key={w} className="text-[11.5px] text-ink-faint mt-0.5">{w}</div>)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
