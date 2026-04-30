export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';
import { requireAdmin } from '@/lib/auth/server';
export async function GET(){const rows=await sql`SELECT value FROM settings WHERE key='ticket_price' LIMIT 1`; return NextResponse.json({price:rows[0]?.value || process.env.DEFAULT_TICKET_PRICE || '40'});}
export async function POST(req:Request){try{requireAdmin(req); const {price}=await req.json(); if(Number(price)<=0)return NextResponse.json({error:'Invalid price'}, {status:400}); await sql`INSERT INTO settings(key,value) VALUES('ticket_price',${String(price)}) ON CONFLICT(key) DO UPDATE SET value=${String(price)}`; return NextResponse.json({success:true});}catch(e:any){return NextResponse.json({error:e.message}, {status:401})}}
