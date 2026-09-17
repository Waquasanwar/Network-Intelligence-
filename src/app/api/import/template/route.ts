import { templateCsv } from "@/lib/csv";

export async function GET() {
  return new Response(templateCsv(), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="network-intelligence-contacts-template.csv"' },
  });
}
