import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import db from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const openAiKey = process.env.OPENAI_API_KEY;
        if (!openAiKey) {
            return NextResponse.json(["Offline Marketing Managers in Mumbai", "BTL Strategy directors in Delhi"], { status: 200 });
        }

        const prevQueriesRaw = db.prepare('SELECT query_text FROM queries ORDER BY id DESC LIMIT 15').all();
        const previousQueries = prevQueriesRaw.map((q: any) => q.query_text);

        const openai = new OpenAI({ apiKey: openAiKey });

        const prompt = `
    You are an AI assistant in a LinkedIn Lead Generation Tool for B2B marketers.
    Your task is to suggest 3 fresh, varied, natural language search intents for the user to try.
    Our system accepts natural language inputs like "Find Trade Marketing leads working in top FMCG companies".
    
    Here is what the user searched recently (in boolean/X-Ray format):
    ${JSON.stringify(previousQueries)}

    Please generate 3 novel, completely different natural language queries targeting ideal customer profiles (e.g., experiential marketing, trade marketing, enterprise sales, SaaS founders, HR heads, etc.).
    Make them short but descriptive (about 6-12 words).
    Do NOT output raw boolean queries, output natural language.
    If the previous queries are empty or irrelevant, suggest general high-quality B2B marketing/sales leads.

    Output ONLY a raw JSON array of 3 strings. NO markdown, NO conversational text.
    `;

        const aiRes = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.8
        });

        let suggestions = [];
        try {
            const text = aiRes.choices[0].message.content || '[]';
            suggestions = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
            if (!Array.isArray(suggestions) || suggestions.length === 0) {
                throw new Error("Invalid format");
            }
        } catch {
            suggestions = [
                "Trade Marketing professionals in FMCG companies",
                "Experiential Marketing professionals in Mumbai & Delhi",
                "Offline Marketing and Events Directors"
            ];
        }

        return NextResponse.json(suggestions);
    } catch (err: any) {
        return NextResponse.json(["Trade Marketing professionals in FMCG companies", "SaaS Founders in Bangalore", "BTL Agency Growth Heads"], { status: 200 });
    }
}
