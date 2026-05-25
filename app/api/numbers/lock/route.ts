import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Pooled lottery mode:
// Number selection must NOT be blocked by temporary locks.
// A number is unselectable only when its pool is closed/target reached.
export async function POST() {
  return NextResponse.json({ ok: true, pooledMode: true });
}

export async function DELETE() {
  return NextResponse.json({ ok: true, pooledMode: true });
}
