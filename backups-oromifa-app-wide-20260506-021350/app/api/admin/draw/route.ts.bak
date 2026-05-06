export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';
import { createAutomaticBackup } from '@/lib/backup/autoBackup';
import { requireAdmin } from '@/lib/auth/server';
import { randomInt } from 'crypto';
export async function POST(req:Request){try{const admin=requireAdmin(req); const approved=await sql`SELECT s.number, s.user_id, u.name, u.phone FROM submissions s JOIN users u ON s.user_id=u.id WHERE s.status='approved'`; if(!approved.length)await createAutomaticBackup('draw');

    return NextResponse.json({error:'No approved numbers'}, {status:400}); const winner=approved[randomInt(approved.length)]; const inserted=await sql`INSERT INTO winners(number,user_id,user_name,user_phone,drawn_at) VALUES(${winner.number},${winner.user_id},${winner.name},${winner.phone},NOW()) RETURNING *`; await sql`INSERT INTO audit_logs(admin_id,action,details) VALUES(${admin.userId},'draw_winner',${JSON.stringify({winner:inserted[0]})})`; return NextResponse.json({number:winner.number,userName:winner.name,userPhone:winner.phone,winner:inserted[0]});}catch(e:any){return NextResponse.json({error:e.message||'Draw failed'}, {status:500})}}
