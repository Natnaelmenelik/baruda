export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/auth/server';
export async function POST(req:Request){try{verifyRequest(req); const {image}=await req.json(); if(!image || !String(image).startsWith('data:image/')) return NextResponse.json({error:'Valid image is required'}, {status:400}); if(String(image).length > 4_500_000) return NextResponse.json({error:'Image too large'}, {status:400}); return NextResponse.json({url:image});}catch{return NextResponse.json({error:'Unauthorized'}, {status:401})}}
