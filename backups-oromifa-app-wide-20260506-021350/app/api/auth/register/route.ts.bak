export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { sql } from '@/lib/db/sql';
function fmt(phone:string){return phone?.startsWith('0')?'+251'+phone.slice(1):phone;}
export async function POST(req: Request) {
  try { const { phone, name, email, password } = await req.json(); if(!phone||!name||!password) return NextResponse.json({error:'Phone, name, and password are required'}, {status:400});
    const p=fmt(phone); const existing=await sql`SELECT id FROM users WHERE phone=${p} LIMIT 1`; if(existing.length) return NextResponse.json({error:'Phone already registered'}, {status:400});
    const hashed=await bcrypt.hash(password,10); const adminPhone=process.env.ADMIN_PHONE || '0926869698'; const isAdmin = phone===adminPhone || p===fmt(adminPhone);
    await sql`INSERT INTO users (phone,name,email,password,is_admin,created_at) VALUES (${p},${name},${email||null},${hashed},${isAdmin},NOW())`;
    return NextResponse.json({success:true});
  } catch { return NextResponse.json({error:'Registration failed'}, {status:500}); }
}
