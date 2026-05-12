import { NextResponse } from "next/server";
import { startBatchRun } from "@/server/batch/run";

export async function POST(_request: Request, context: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await context.params;

  try {
    const batch = await startBatchRun(batchId);
    return NextResponse.json({ batch });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
