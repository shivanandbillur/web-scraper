import { NextResponse } from 'next/server';
import db from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const queries = db.prepare('SELECT id, query_text, timestamp FROM queries ORDER BY id DESC LIMIT 100').all();
        return NextResponse.json(queries);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
