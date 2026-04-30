export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';
export async function GET(){await sql`DELETE FROM number_locks WHERE expires_at<NOW()`; const locks=await sql`SELECT number, expires_at FROM number_locks WHERE expires_at>NOW()`; return NextResponse.json(locks);}
