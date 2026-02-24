import { NextResponse } from 'next/server';
import { chromium } from 'playwright';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import db from '../../../lib/db';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      function sendUpdate(type: string, data: any) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`));
        } catch { /* stream closed */ }
      }

      let browser = null;
      try {
        const payload = await req.json();
        const { query, numResults = 10, enableDynamicExclusions = true, manualExclusions = [] } = payload;

        const openAiKey = process.env.OPENAI_API_KEY;
        if (!openAiKey) {
          sendUpdate('error', "OpenAI API Key is missing in .env.local file. Please add it and restart the server.");
          controller.close();
          return;
        }

        const targetCount = Math.min(Number(numResults) || 10, 1000);

        // --- EXCLUSION LOGIC (Read from SQLite + leadsc - sheet1 (1).csv) --- //
        sendUpdate('log', `Reading exclusion list from Database and leadsc - sheet1 (1).csv...`);
        const exclusionSet = new Set<string>();

        const csvPath = path.join(process.cwd(), 'leadsc - sheet1 (1).csv');
        if (fs.existsSync(csvPath)) {
          const fileContent = fs.readFileSync(csvPath, 'utf-8');
          const matches = fileContent.match(/https?:\/\/[a-z]{0,3}\.?linkedin\.com\/in\/[^\s",]+/gi);
          if (matches) {
            matches.forEach(m => exclusionSet.add(m.split('?')[0].replace(/\/$/, "").toLowerCase()));
          }
        }

        const getHandle = (url: string) => {
          try {
            const clean = url.split('?')[0].replace(/\/$/, "").toLowerCase();
            const parts = clean.split('/in/');
            if (parts.length > 1) return parts[1].split(/[ \/]/)[0]; // handle spaces at the end
            const pubParts = clean.split('/pub/');
            if (pubParts.length > 1) return pubParts[1].split(/[ \/]/)[0];

            // Handle weird pasted formats like "ca.linkedin.com › in › yogesh-babu..."
            const match = clean.match(/›\s*in\s*›\s*([^\s\/"?',|]+)/i);
            if (match && match[1]) return match[1].trim();

            return clean;
          } catch { return url; }
        };

        // Also fetch any existing leads from the SQLite database
        const dbLeads = db.prepare('SELECT url FROM leads').all();
        dbLeads.forEach((l: any) => exclusionSet.add(getHandle(l.url)));

        if (Array.isArray(manualExclusions) && manualExclusions.length > 0) {
          manualExclusions.forEach(url => {
            if (url) exclusionSet.add(getHandle(url));
          });
          sendUpdate('log', `Added ${manualExclusions.length} manual exclusions.`);
        }

        sendUpdate('log', `Loaded a total of ${exclusionSet.size} unique URLs into the Exclusion Filter.`);

        // --- CORE EXTRACTION LOOP --- //
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        });
        const page = await context.newPage();

        let collectedLeads: any[] = [];
        let totalScrapedRawLeads = 0;
        const openai = new OpenAI({ apiKey: openAiKey });

        while (collectedLeads.length < targetCount) {
          sendUpdate('log', `[Goal: ${collectedLeads.length}/${targetCount}] Initializing Agentic AI Planner to craft novel search queries...`);

          const prevQueriesRaw = db.prepare('SELECT query_text FROM queries').all();
          const previousQueries = prevQueriesRaw.map((q: any) => q.query_text);

          const promptParts = {
            p1: enableDynamicExclusions ? "             - Add minus operators (-word) in the query itself to exclude unwanted profiles matching the anti-persona.\n" : "",
            p2: enableDynamicExclusions ? "          2. A list of negative keywords/phrases to filter out unwanted profiles post-search. For example, if the user is looking for Brands/Clients for BTL marketing, exclude vendors: [\"agency\", \"event management\", \"event planner\"]. If they are looking for SaaS influencers, maybe exclude: [\"intern\", \"student\", \"fresher\"].\n" : "",
            p3: enableDynamicExclusions ? "            ,\n            \"exclusions\": [\"word1\", \"phrase2\"]\n" : "\n"
          };

          const prompt = `
          The user is looking for LinkedIn profiles based on a natural language intent.
          Your goal is to understand their Ideal Customer Profile (ICP). 
          
          User Request: "${query.replace(/"/g, '')}"
          Location Scope: "India" (STRICTLY INDIA ONLY. You MUST generate search queries targeting India ONLY).
          
          You must generate:
          1. Exactly 3 novel Google/Yahoo X-Ray search query strings to find these leads. Each query must start with: site:linkedin.com/in/
             - Use OR blocks for synonyms.
             - Add "India" and aggressive location negative matches (e.g., -"USA" -"United States" -"Canada" -"UK") to ensure ONLY profiles in India are fetched.
${promptParts.p1}${promptParts.p2}          
          CRITICAL: AVOID generating these specific queries that were already searched recently: ${JSON.stringify(previousQueries)}
          
          Return a JSON object strictly matching this format:
          {
            "queries": ["site:linkedin.com/in/... \"India\" -\"USA\"", "site:linkedin.com/in/..."]${promptParts.p3}          }
          DO NOT include markdown block formatting. Return the raw valid JSON ONLY.
          `;

          const aiRes = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.9 // High temperature for diverse query structures 
          });

          let generatedQueries: string[] = [];
          let dynamicExclusions: string[] = [];

          try {
            const text = aiRes.choices[0].message.content || '{}';
            const parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());

            if (Array.isArray(parsed)) {
              generatedQueries = parsed;
            } else if (parsed && parsed.queries && Array.isArray(parsed.queries)) {
              generatedQueries = parsed.queries;
              dynamicExclusions = Array.isArray(parsed.exclusions) ? parsed.exclusions : [];
            } else {
              throw new Error("Invalid structure");
            }
          } catch {
            sendUpdate('log', `Failed to parse AI response natively. Creating fallback query.`);
            generatedQueries = [`site:linkedin.com/in/ "${query}" "India"`];
            dynamicExclusions = [];
          }

          sendUpdate('ai_queries', generatedQueries);
          sendUpdate('log', `AI Selected ${generatedQueries.length} Optimized Queries to run for this batch.`);

          let offset = 1;
          let queryIndex = 0;

          while (collectedLeads.length < targetCount && queryIndex < generatedQueries.length) {
            if (req.signal.aborted) {
              sendUpdate('log', 'User terminated connection. Stopping search safely.');
              break;
            }

            const activeSearchTerm = generatedQueries[queryIndex];

            // Verify we haven't run this query already
            try {
              db.prepare('INSERT INTO queries (query_text) VALUES (?)').run(activeSearchTerm);
            } catch (e) {
              sendUpdate('log', `[Query ${queryIndex + 1}/${generatedQueries.length}] Already processed in DB. Skipping to save time.`);
              offset = 1;
              queryIndex++;
              continue;
            }

            const searchUrl = `https://search.yahoo.com/search?p=${encodeURIComponent(activeSearchTerm)}&b=${offset}`;
            sendUpdate('log', `[Query ${queryIndex + 1}/${generatedQueries.length}] Searching Directory... Offset: ${offset}`);

            await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

            // Artificial delay to prevent search engine blockage
            const delay = 2500 + Math.random() * 2000;
            sendUpdate('log', `Pausing for ${Math.round(delay / 1000)}s to imitate human browsing...`);
            await page.waitForTimeout(delay);

            const urlsFromPage = await page.evaluate(() => {
              const rows = document.querySelectorAll('.compTitle');
              return Array.from(rows).map(row => {
                const a = row.querySelector('a');
                const url = a ? a.href : '';
                const titleTextRaw = a ? a.innerText : '';
                const titleLines = titleTextRaw.split('\n');
                const titleText = titleLines[titleLines.length - 1] || '';

                const parent = row.parentElement;
                const descNode = parent?.querySelector('.compText');
                const descText = descNode ? (descNode as HTMLElement).innerText : '';

                let name = "Unknown";
                let title = "Unknown";
                let company = "Unknown";

                const parts = titleText.split(' - ');
                if (parts.length > 0) name = parts[0].trim();
                if (parts.length > 1) {
                  const subParts = parts[1].split(' | ');
                  title = subParts[0].trim();
                }
                if (parts.length > 2) {
                  const companyParts = parts[2].split(' | ');
                  company = companyParts[0].trim();
                }

                return { url, name, title, company, bio: descText };
              })
                .filter(item => item.url.startsWith('http'))
                .filter(item => {
                  const urlStr = item.url.toLowerCase();
                  // Strictly enforce Indian or generic linkedin dot com domains, reject subdomains like ca.linkedin.com or uk.linkedin.com unless it's in.linkedin.com
                  const isForeignDomain = urlStr.match(/https?:\/\/(?!in\.)[a-z]{2,3}\.linkedin\.com\//);
                  if (isForeignDomain) return false;

                  return urlStr.includes('linkedin.com/in') || urlStr.includes('linkedin.com/pub');
                });
            });

            totalScrapedRawLeads += urlsFromPage.length;
            sendUpdate('stats', {
              rawLeadsFound: totalScrapedRawLeads,
              currentQuery: queryIndex + 1,
              totalQueries: generatedQueries.length
            });

            if (urlsFromPage.length === 0) {
              sendUpdate('log', `Search engine query results exhausted. Moving to next AI query...`);
              offset = 1;
              queryIndex++;
              continue;
            }

            let added = 0;
            for (const rawLead of urlsFromPage) {
              if (req.signal.aborted) break;

              const fullTextCheck = `${rawLead.name} ${rawLead.title} ${rawLead.company} ${rawLead.bio}`.toLowerCase();
              const cleanUrl = rawLead.url.split('?')[0].replace(/\/$/, "").toLowerCase();
              const profileHandle = getHandle(cleanUrl);

              if (enableDynamicExclusions && dynamicExclusions && dynamicExclusions.length > 0) {
                const safeExclusions = dynamicExclusions.map((e: string) => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                const exclusionRegex = new RegExp(`\\b(${safeExclusions.join('|')})\\b`, 'i');
                if (exclusionRegex.test(fullTextCheck)) {
                  sendUpdate('log', `Filtered out anti-persona lead dynamically: ${rawLead.name || profileHandle}`);
                  continue;
                }
              }

              if (!collectedLeads.some(l => l.url.toLowerCase().includes(cleanUrl)) && !exclusionSet.has(profileHandle) && !exclusionSet.has(cleanUrl)) {
                // Validate location strictly for India
                if (fullTextCheck.match(/\b(united states|usa|canada|uk|united kingdom|australia|germany|france|singapore|dubai|uae)\b/i)) {
                  sendUpdate('log', `Filtered out non-India lead: ${rawLead.name || profileHandle}`);
                  continue;
                }

                if (rawLead.name === "Sign Up | LinkedIn") rawLead.name = "Unknown";

                const extractedItem = {
                  url: rawLead.url,
                  data: [{
                    name: rawLead.name,
                    jobTitle: rawLead.title,
                    company: rawLead.company,
                    location: "India",
                    emails: [],
                    rawBio: rawLead.bio
                  }]
                };

                collectedLeads.push(extractedItem);
                added++;

                // Save to SQLite
                try {
                  db.prepare(`
                          INSERT INTO leads (url, name, job_title, company, location, emails, bio)
                          VALUES (?, ?, ?, ?, ?, ?, ?)
                       `).run(cleanUrl, rawLead.name, rawLead.title, rawLead.company, "India", "", rawLead.bio);
                } catch (err) { /* ignore duplicate insertions if any edge case */ }

                // Append perfectly into user CSV
                try {
                  const dateStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
                  const safeString = (str: string) => str.replace(/"/g, '""');
                  const csvLine = `"${safeString(rawLead.name)}","${safeString(rawLead.title)}","","","","India","${safeString(rawLead.company)}","","India","","${rawLead.url}","","${dateStr}","AI WebAgent","Automated X-Ray","","","",\n`;
                  fs.appendFileSync(csvPath, csvLine);
                } catch (err) {
                  sendUpdate('log', `Warning: Could not write to leadsc - sheet1 (1).csv`);
                }

                sendUpdate('item_extracted', extractedItem);
              }
              if (collectedLeads.length >= targetCount) break;
            }

            offset += 10;

            if (added === 0 && urlsFromPage.length < 10 && offset > 30) {
              sendUpdate('log', `Reached deep end of search pagination. Moving to next query...`);
              offset = 1;
              queryIndex++;
              continue;
            }
          }
        }

        sendUpdate('log', `Job complete! Appended ${collectedLeads.length} leads directly into your database and CSV.`);
        sendUpdate('done', collectedLeads);

      } catch (err) {
        sendUpdate('error', String(err));
      } finally {
        if (browser) await browser.close();
        controller.close();
      }
    }
  });

  return new NextResponse(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
} 
