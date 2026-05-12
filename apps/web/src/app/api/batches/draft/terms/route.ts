import { NextResponse } from "next/server";
import { generateBatchDraftTerms } from "@/server/batch/draft";

type DraftRequestItem = {
  subject: string;
  script: string;
};

function itemsFromBody(body: any) {
  return Array.isArray(body?.items)
    ? body.items.map((item: any) => ({
        subject: String(item?.subject || ""),
        script: item?.script ? String(item.script) : "",
        terms: [],
      }))
    : [];
}

export async function POST(request: Request) {
  const body = await request.json();
  const items = itemsFromBody(body).filter((item: DraftRequestItem) => item.subject || item.script);
  if (!items.length) {
    return NextResponse.json({ error: "At least one subject or script is required." }, { status: 400 });
  }

  const language = String(body?.language || "");
  const drafts = await generateBatchDraftTerms({ items, language });
  return NextResponse.json({ items: drafts });
}
