export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/auth/server';
export async function GET(req:Request){try{return NextResponse.json({user:verifyRequest(req)})}catch{return NextResponse.json({error:'Unauthorized'}, {status:401})}}
