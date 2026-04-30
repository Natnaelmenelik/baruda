export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { sql } from '@/lib/db/sql';
export async function POST(req:Request){try{const {token,password}=await req.json(); const rows=await sql`SELECT * FROM password_resets WHERE token=${token} AND used_at IS NULL AND expires_at>NOW() LIMIT 1`; if(!rows.length)return NextResponse.json({error:'Invalid or expired token'}, {status:400}); const hash=await bcrypt.hash(password,10); await sql`UPDATE users SET password=${hash}, updated_at=NOW() WHERE id=${rows[0].user_id}`; await sql`UPDATE password_resets SET used_at=NOW() WHERE id=${rows[0].id}`; return NextResponse.json({success:true});}catch{return NextResponse.json({error:'Reset failed'}, {status:500})}}
