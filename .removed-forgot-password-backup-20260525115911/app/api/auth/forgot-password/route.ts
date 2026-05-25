export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';
import { randomUUID } from 'crypto';
import { consumeRateLimit, getClientIp, normalizeRateLimitKey } from '@/lib/rate-limit';

const FORGOT_PASSWORD_LIMIT = 3;
const FORGOT_PASSWORD_WINDOW_MS = 60 * 60 * 1000;
export async function POST(req:Request){const {email}=await req.json(); if(!email) return NextResponse.json({error:'Email is required'}, {status:400}); const ip=getClientIp(req); const normalizedEmail=normalizeRateLimitKey(email); const rate=consumeRateLimit({key:`auth-forgot-password:${ip}:${normalizedEmail}`,limit:FORGOT_PASSWORD_LIMIT,windowMs:FORGOT_PASSWORD_WINDOW_MS}); if(!rate.allowed) return NextResponse.json({error:'Too many password reset requests. Please try again after 1 hour.',retryAfterSeconds:rate.retryAfterSeconds},{status:429,headers:{'Retry-After':String(rate.retryAfterSeconds)}}); const users=await sql`SELECT id FROM users WHERE email=${email} LIMIT 1`; if(users.length){const token=randomUUID(); await sql`INSERT INTO password_resets (user_id, token, expires_at) VALUES (${users[0].id},${token},NOW()+INTERVAL '1 hour')`; console.log('Password reset link:', `/reset-password?token=${token}`);} return NextResponse.json({message:'If this email exists, a reset link was generated. Check server logs or connect email sending.'});}
