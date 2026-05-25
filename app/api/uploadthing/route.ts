import { NextResponse } from 'next/server';
export async function GET() { return NextResponse.json({ error: 'UploadThing disabled. Use Supabase Storage.' }, { status: 410 }); }
export async function POST() { return NextResponse.json({ error: 'UploadThing disabled. Use Supabase Storage.' }, { status: 410 }); }
