export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';
import { randomUUID } from 'crypto';
export async function POST(req:Request){const {email}=await req.json(); if(!email) return NextResponse.json({error:'Email is required'}, {status:400}); const users=await sql`SELECT id FROM users WHERE email=${email} LIMIT 1`; if(users.length){const token=randomUUID(); await sql`INSERT INTO password_resets (user_id, token, expires_at) VALUES (${users[0].id},${token},NOW()+INTERVAL '1 hour')`; console.log('Password reset link:', `/reset-password?token=${token}`);} return NextResponse.json({message:'If this email exists, a reset link was generated. Check server logs or connect email sending.'});}
