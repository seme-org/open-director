import { NextResponse } from "next/server";
import { generateBatchDraftScripts } from "@/server/batch/draft";

type DraftRequestItem = {
  subject: string;
  script: string;
  terms: string[];
};

function itemsFromBody(body: any) {
  return Array.isArray(body?.items)
    ? body.items.map((item: any) => ({
        subject: String(item?.subject || ""),
        script: item?.script ? String(item.script) : "",
        terms: Array.isArray(item?.terms) ? item.terms.map((term: unknown) => String(term)).filter(Boolean) : [],
      }))
    : [];
}

export async function POST(request: Request) {
  const body = await request.json();
  const items = itemsFromBody(body).filter((item: DraftRequestItem) => item.subject || item.script);
  if (!items.length) {
    return NextResponse.json({ error: "At least one subject or script is required." }, { status: 400 });
  }

  const drafts = await generateBatchDraftScripts({
    items,
    language: String(body?.language || ""),
    tone: String(body?.tone || "clear, concise, engaging"),
    audience: String(body?.audience || "general short-video audience"),
    paragraphCount: Number(body?.paragraphCount || 1),
  });

  return NextResponse.json({ items: drafts });
}
