import { NextResponse } from 'next/server';
import { chromium } from 'playwright';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import db from '../../../lib/db';
import pRetry from 'p-retry';

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
      let sessionTotalCost = 0;
      let collectedLeads: any[] = [];
      let totalScrapedRawLeads = 0;
      let totalRejected = 0;
      let aiCallCount = 0;
      const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      try {
        const payload = await req.json();
        const { query, numResults = 10, enableDynamicExclusions = true, manualExclusions = [], spendLimit = 0.5 } = payload;

        // Save the original input query to DB for history
        try {
          db.prepare('INSERT OR IGNORE INTO queries (query_text) VALUES (?)').run(`INPUT_PROMPT: ${query}`);
        } catch (e) { }

        const openAiKey = process.env.OPENAI_API_KEY;
        if (!openAiKey) {
          sendUpdate('error', "OpenAI API Key is missing in .env.local file. Please add it and restart the server.");
          controller.close();
          return;
        }

        const targetCount = Math.min(Number(numResults) || 10, 1000);

        // --- EXCLUSION LOGIC --- //
        sendUpdate('log', `Reading exclusion list from Database and CSV...`);
        const exclusionSet = new Set<string>();

        const getHandle = (url: string) => {
          try {
            const clean = url.split('?')[0].replace(/\/$/, "").toLowerCase();
            const parts = clean.split('/in/');
            if (parts.length > 1) return parts[1].split(/[ \/]/)[0];
            const pubParts = clean.split('/pub/');
            if (pubParts.length > 1) return pubParts[1].split(/[ \/]/)[0];
            return clean;
          } catch { return url; }
        };

        const csvPath = path.join(process.cwd(), 'leadsc - sheet1 (1).csv');
        if (fs.existsSync(csvPath)) {
          const fileContent = fs.readFileSync(csvPath, 'utf-8');
          const matches = fileContent.match(/(?:https?:\/\/)?(?:[a-z]{0,3}\.)?linkedin\.com\/(?:in|pub)\/[^\s",?\/]+/gi);
          if (matches) {
            matches.forEach(m => {
              const cleanUrl = m.split('?')[0].replace(/\/$/, "").toLowerCase();
              exclusionSet.add(cleanUrl);
              exclusionSet.add(getHandle(cleanUrl));
            });
          }
        }

        const dbLeads = db.prepare('SELECT url FROM leads').all();
        dbLeads.forEach((l: any) => {
          const u = l.url.toLowerCase().trim();
          exclusionSet.add(u);
          exclusionSet.add(getHandle(u));
        });

        if (Array.isArray(manualExclusions) && manualExclusions.length > 0) {
          manualExclusions.forEach(url => { if (url) { const u = url.toLowerCase().trim(); exclusionSet.add(u); exclusionSet.add(getHandle(u)); } });
        }

        sendUpdate('log', `Loaded ${exclusionSet.size} exclusions.`);

        // --- BROWSER SETUP --- //
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        });

        // Session-level set to avoid re-using same queries (in-memory only, not DB-dependent)
        // Rolling window: track used queries as an array, trimmed to last WINDOW_SIZE
        // This prevents the Set from growing infinitely and blocking all queries
        const SESSION_WINDOW = 150; // Keep last 150 queries in memory
        const sessionQueriesLog: string[] = []; // ordered log
        const sessionQueriesSet = new Set<string>(); // fast lookup
        let consecutiveExhaustedRounds = 0; // track stuck loops
        const MAX_CONSECUTIVE_EXHAUSTED = 3; // force-clear after 3 failed rounds

        const addSessionQuery = (q: string) => {
          const norm = q.toLowerCase().trim();
          if (sessionQueriesSet.has(norm)) return;
          sessionQueriesSet.add(norm);
          sessionQueriesLog.push(norm);
          // Rolling window: evict oldest if over limit
          if (sessionQueriesLog.length > SESSION_WINDOW) {
            const evicted = sessionQueriesLog.shift()!;
            sessionQueriesSet.delete(evicted);
          }
        };

        // Query format strategies — weighted by whether an industry is known
        // When industry detected: 75% company-based searches, 25% city+role
        // When no industry: balanced rotation
        const QUERY_STRATEGIES_GENERIC = [
          'intitle_city',    // site:linkedin.com/in/ intitle:"ROLE" "CITY"
          'role_city_kw',    // site:linkedin.com/in/ "ROLE" "CITY" "KEYWORD"
          'city_keyword',    // site:linkedin.com/in/ "CITY" "COMPANY" "ROLE"
          'company_role',    // site:linkedin.com/in/ "COMPANY" ("ROLE1" OR "ROLE2")
        ];
        const QUERY_STRATEGIES_INDUSTRY = [
          'company_role',    // "COMPANY" ("VP" OR "Director") — targets specific companies
          'company_role',    // repeat for weight
          'company_role',    // repeat for weight
          'role_city_kw',    // "ROLE" "CITY" "KEYWORD" — catch-all
        ];
        // Will be assigned inside loop after detectedIndustry is known

        const CITIES = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Pune', 'Chennai', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Lucknow', 'Surat', 'Kochi', 'Nagpur', 'Bhopal', 'Chandigarh', 'Indore', 'Coimbatore', 'Vizag', 'Vadodara', 'Patna', 'Mysore', 'Guwahati', 'Raipur', 'Bhubaneswar', 'Amritsar', 'Agra', 'Varanasi', 'Rajkot', 'Jodhpur', 'Goa'];
        const ROLES = ['BTL Manager', 'Trade Marketing Head', 'Activation Lead', 'Field Marketing Executive', 'Experiential Marketing Manager', 'Rural Activation Manager', 'Brand Activation Head', 'Merchandising Manager', 'BTL Executive', 'Promotion Manager', 'Trade Activation Executive', 'Visual Merchandising Manager', 'Offline Marketing Manager', 'Zone Marketing Manager', 'Area Activation Manager', 'Ground Operations Head', 'BTL Lead', 'Channel Marketing Manager', 'Shopper Marketing Manager', 'Rural Marketing Manager', 'Event Marketing Manager', 'Trade Marketing Coordinator', 'BTL Activation Specialist', 'Retail Activation Manager', 'Sales Promotions Manager'];

        // --- INDUSTRY-AWARE COMPANY POOLS --- //
        const INDUSTRY_COMPANIES: Record<string, string[]> = {
          alcohol: ['Diageo India', 'United Spirits', 'ABInBev India', 'Pernod Ricard India', 'Radico Khaitan', 'Allied Blenders', 'Tilaknagar Industries', 'Heineken India', 'Carlsberg India', 'Bacardi India', 'William Grant', 'Beam Suntory India', 'Sula Vineyards', 'Fratelli Wines', 'SOM Distilleries', 'Globus Spirits', 'John Distilleries', 'Molson Coors India'],
          pharma: ['Sun Pharma', 'Cipla', 'Dr Reddys', 'Lupin', 'Zydus', 'Mankind Pharma', 'Abbott India', 'Pfizer India', 'GSK India', 'Novartis India', 'Torrent Pharma', 'Aurobindo Pharma', 'Ipca Laboratories', 'Alkem Laboratories'],
          auto: ['Maruti Suzuki', 'Tata Motors', 'Mahindra', 'Hyundai India', 'Honda Cars India', 'Toyota India', 'Kia India', 'Bajaj Auto', 'Hero MotoCorp', 'TVS Motor', 'Royal Enfield', 'Ford India', 'Volkswagen India'],
          fmcg: ['Hindustan Unilever', 'ITC Limited', 'Marico', 'Dabur', 'Godrej Consumer', 'Emami', 'Colgate India', 'Nestle India', 'Britannia', 'Parle', 'Amul', 'Reckitt', 'P&G India', 'Johnson & Johnson'],
          ecommerce: ['Flipkart', 'Amazon India', 'Meesho', 'Nykaa', 'Myntra', 'Snapdeal', 'Paytm Mall', 'JioMart', 'BigBasket', 'Blinkit', 'Swiggy', 'Zomato'],
          telecom: ['Airtel', 'Jio', 'Vodafone Idea', 'BSNL', 'Tata Teleservices'],
          finance: ['HDFC Bank', 'ICICI Bank', 'SBI', 'Axis Bank', 'Kotak Mahindra', 'Bajaj Finance', 'IDFC First', 'Yes Bank', 'IndusInd Bank'],
          realestate: ['DLF', 'Godrej Properties', 'Prestige Group', 'Brigade Group', 'Sobha', 'Lodha', 'Puravankara', 'Mahindra Lifespaces', 'Embassy Group'],
          food: ['Haldirams', 'Bikaji Foods', 'Prataap Snacks', 'ITC Foods', 'Gujarat Cooperative Milk', 'Cargill India', 'Agro Tech Foods', 'MTR Foods', 'Kohinoor Foods'],
          beauty: ['Lakme', 'Mamaearth', 'Wow Skin Science', 'Plum', 'mCaffeine', 'Sugar Cosmetics', 'Biotique', 'Forest Essentials', 'Kama Ayurveda', 'OTC Beauty'],
        };
        const DEFAULT_COMPANIES = ['Hindustan Unilever', 'ITC Limited', 'Marico', 'Dabur', 'Godrej', 'Emami', 'Colgate', 'Nestle India', 'Britannia', 'Parle', 'Amul', 'Coca-Cola India', 'PepsiCo India', 'Asian Paints', 'Berger Paints', 'Pidilite', 'Reckitt', 'P&G India', 'Johnson & Johnson', 'Nokia India', 'Samsung India', 'LG Electronics', 'Bajaj Auto', 'Hero MotoCorp', 'TVS Motor', 'Vodafone Idea', 'Airtel', 'Jio', 'HDFC Bank', 'SBI'];
        const KEYWORDS_POOL = ['BTL activation', 'offline marketing', 'trade marketing', 'experiential marketing', 'rural activation', 'field marketing', 'merchandising', 'brand activation', 'shopper marketing', 'retail marketing'];

        // Detect industry from user query once (outside the loop)
        const queryForIndustry = query.toLowerCase();
        const detectedIndustry = (
          /alcohol|liquor|spirits|beer|wine|whisky|whiskey|rum|vodka|gin|abv|distill|brewery|breweries/.test(queryForIndustry) ? 'alcohol' :
            /pharma|medicine|drug|healthcare|hospital|clinic|biotech/.test(queryForIndustry) ? 'pharma' :
              /auto|automobile|car|vehicle|motorbike|two.?wheel|four.?wheel|ev|electric vehicle/.test(queryForIndustry) ? 'auto' :
                /ecommerce|e-commerce|online retail|marketplace/.test(queryForIndustry) ? 'ecommerce' :
                  /telecom|mobile network|isp|broadband/.test(queryForIndustry) ? 'telecom' :
                    /bank|finance|insurance|fintech|nbfc|lending/.test(queryForIndustry) ? 'finance' :
                      /real.?estate|property|housing|construction|realty/.test(queryForIndustry) ? 'realestate' :
                        /food|snack|beverage|drink|restaurant|qsr/.test(queryForIndustry) ? 'food' :
                          /beauty|cosmetic|skincare|personal care|grooming/.test(queryForIndustry) ? 'beauty' :
                            /fmcg|consumer goods|packaged goods/.test(queryForIndustry) ? 'fmcg' :
                              null
        );
        const COMPANIES = detectedIndustry ? INDUSTRY_COMPANIES[detectedIndustry] : DEFAULT_COMPANIES;

        // Helper to send live stats
        const sendStats = () => {
          sendUpdate('stats', {
            rawLeadsFound: totalScrapedRawLeads,
            rejected: totalRejected,
            kept: collectedLeads.length,
          });
        };

        // --- CORE EXTRACTION LOOP --- //
        while (collectedLeads.length < targetCount) {
          if (req.signal.aborted) break;
          if (sessionTotalCost >= spendLimit) {
            sendUpdate('log', `Spend Limit $${spendLimit} reached.`);
            break;
          }

          aiCallCount++;
          sendUpdate('log', `[Progress: ${collectedLeads.length}/${targetCount}] AI Planning Phase ${aiCallCount}...`);

          // If stuck too many consecutive rounds, force-clear older half of session cache
          if (consecutiveExhaustedRounds >= MAX_CONSECUTIVE_EXHAUSTED) {
            const halfSize = Math.floor(sessionQueriesLog.length / 2);
            const evicted = sessionQueriesLog.splice(0, halfSize);
            evicted.forEach(q => sessionQueriesSet.delete(q));
            consecutiveExhaustedRounds = 0;
            sendUpdate('log', `♻️ Refreshed query pool — evicted ${halfSize} old queries, ${sessionQueriesSet.size} remain.`);
          }

          // Pick strategy — prefer company_role heavily when industry is known
          const QUERY_STRATEGIES = detectedIndustry ? QUERY_STRATEGIES_INDUSTRY : QUERY_STRATEGIES_GENERIC;
          const strategyKey = QUERY_STRATEGIES[aiCallCount % QUERY_STRATEGIES.length];

          // Show only the last 25 session queries (not 50+) to the AI to avoid overly long prompts
          const recentForAI = sessionQueriesLog.slice(-25).join('\n');

          // Derive role/seniority signals from the user query to keep AI searches on-topic
          const userQueryLower = query.toLowerCase();
          const isGMQuery = /general\s*manager|\bgm\b|\bvp\b|vice\s*president|head\s*of|director|chief/.test(userQueryLower);
          const isBrandingQuery = /brand(ing)?|brand\s*manager|brand\s*head|brand\s*director|brand\s*marketing/.test(userQueryLower);
          const isBTLQuery = /btl|activation|trade\s*marketing|offline\s*marketing|experiential/.test(userQueryLower);

          // Build role list that matches the user's actual intent
          const queryRoles = isGMQuery && isBrandingQuery
            ? ['VP Brand Marketing', 'VP Branding', 'Head of Brand Marketing', 'Director Brand Marketing', 'Chief Marketing Officer', 'VP Marketing', 'Brand Director', 'General Manager Brand', 'Head of Brand', 'VP - Brand & Marketing']
            : isGMQuery
              ? ['General Manager', 'GM Marketing', 'Head of Marketing', 'VP Marketing', 'Director Marketing', 'Chief Marketing Officer']
              : isBrandingQuery
                ? ['Brand Manager', 'Senior Brand Manager', 'Brand Head', 'Brand Lead', 'Brand Strategist', 'Brand Marketing Manager', 'Brand Director']
                : ROLES;

          const queryKeywords = isGMQuery && isBrandingQuery
            ? ['brand strategy', 'brand management', 'brand marketing', 'offline marketing strategy', 'marketing leadership', 'brand portfolio']
            : isBTLQuery
              ? KEYWORDS_POOL
              : ['brand management', 'marketing management', 'brand strategy', 'marketing leadership', 'brand head'];

          const industryNote = detectedIndustry
            ? `\nINDUSTRY: ${detectedIndustry.toUpperCase()} — use these companies in searches: ${COMPANIES.slice(0, 8).join(', ')}`
            : '';

          const prompt = `
Generate EXACTLY 15 highly diverse LinkedIn X-Ray search strings for India-based professionals matching the user's target role.
USER QUERY: "${query.replace(/"/g, '')}"

TARGET ROLE TYPE: ${isGMQuery && isBrandingQuery ? 'VP / Director / Head of Brand Marketing' : isGMQuery ? 'Senior Leadership / GM / VP' : isBrandingQuery ? 'Brand Manager / Brand Head' : 'BTL/Activation/Trade Marketing'}${industryNote}

STRATEGY THIS ROUND: "${strategyKey}"
${strategyKey === 'intitle_city'
              ? `FORMAT: site:linkedin.com/in/ intitle:"ROLE" "CITY"
ROLES to use (rotate!): ${queryRoles.slice(aiCallCount % 5, (aiCallCount % 5) + 8).join(', ')}
CITIES to use: ${CITIES.slice(aiCallCount % 7, (aiCallCount % 7) + 8).join(', ')}`
              : strategyKey === 'role_city_kw'
                ? `FORMAT: site:linkedin.com/in/ "ROLE" "CITY" "KEYWORD"
ROLES: ${queryRoles.slice((aiCallCount + 3) % 5, (aiCallCount + 3) % 5 + 8).join(', ')}
CITIES: ${CITIES.slice((aiCallCount + 4) % 7, (aiCallCount + 4) % 7 + 8).join(', ')}
KEYWORDS: ${queryKeywords.join(', ')}`
                : strategyKey === 'city_keyword'
                  ? `FORMAT: site:linkedin.com/in/ "CITY" "COMPANY" "ROLE"
CITIES: ${CITIES.slice((aiCallCount + 2) % 7, (aiCallCount + 2) % 7 + 6).join(', ')}
COMPANIES: ${COMPANIES.slice(aiCallCount % 6, (aiCallCount % 6) + 6).join(', ')}
ROLES: ${queryRoles.slice(0, 4).join(', ')}`
                  : `FORMAT: site:linkedin.com/in/ "COMPANY" ("ROLE1" OR "ROLE2")
COMPANIES: ${COMPANIES.slice(aiCallCount % 6, (aiCallCount % 6) + 8).join(', ')}
ROLES: ${queryRoles.slice(0, 4).join(', ')}`
            }

RULES:
- Only India. No international.
- Match the TARGET ROLE TYPE and INDUSTRY above exactly.
- For company_role strategy: use ONLY the listed companies — do NOT use generic FMCG if industry is specified.
- Output ONLY a raw JSON array of 15 strings.

ALREADY SEARCHED (avoid these):
${recentForAI}

Output ONLY: ["query1", "query2", ...]
          `;

          const openai = new OpenAI({ apiKey: openAiKey });
          const aiRes = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: "Output ONLY a valid JSON array of search query strings. No markdown, no explanation." }, { role: "user", content: prompt }],
            temperature: 1.3,
          });

          if (aiRes.usage) {
            const cost = (aiRes.usage.prompt_tokens * 0.15 / 1000000) + (aiRes.usage.completion_tokens * 0.60 / 1000000);
            sessionTotalCost += cost;
            // Persist to DB for all-time tracking
            try {
              db.prepare('INSERT INTO cost_log (session_id, prompt_tokens, completion_tokens, cost_usd, model) VALUES (?, ?, ?, ?, ?)').run(
                sessionId,
                aiRes.usage.prompt_tokens,
                aiRes.usage.completion_tokens,
                cost,
                'gpt-4o-mini'
              );
            } catch (e) { }
            // Read all-time cumulative cost from DB
            const allTimeRow = db.prepare('SELECT SUM(cost_usd) as total FROM cost_log').get() as any;
            const allTimeCost = allTimeRow?.total ?? 0;
            sendUpdate('cost_update', { totalCost: sessionTotalCost, lastCallCost: cost, allTimeCost });
          }

          let generatedQueries: string[] = [];
          try {
            const text = aiRes.choices[0].message.content || '[]';
            const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
            generatedQueries = JSON.parse(cleaned);
            if (!Array.isArray(generatedQueries)) generatedQueries = [`site:linkedin.com/in/ "${query}" "India"`];
          } catch {
            generatedQueries = [`site:linkedin.com/in/ "${query}" "India"`];
          }

          // Filter out any queries already in rolling window
          const newQueries = generatedQueries.filter(q => !sessionQueriesSet.has(q.toLowerCase().trim()));

          if (newQueries.length === 0) {
            consecutiveExhaustedRounds++;
            sendUpdate('log', `⚠️ All queries already used (round ${consecutiveExhaustedRounds}/${MAX_CONSECUTIVE_EXHAUSTED}). Rotating strategy...`);
            continue;
          }

          consecutiveExhaustedRounds = 0; // reset on success
          sendUpdate('log', `🔍 Batch: ${newQueries.length} fresh queries [strategy: ${strategyKey}]`);

          // Mark all as used in rolling window
          newQueries.forEach(q => {
            addSessionQuery(q);
            try {
              db.prepare('INSERT OR IGNORE INTO queries (query_text) VALUES (?)').run(q);
            } catch (e) { }
          });

          // Run all queries in this batch in parallel (15 threads)
          const searchTasks = newQueries.map(async (searchTerm, queryIndex) => {
            if (req.signal.aborted) return;

            const queryPage = await context.newPage();
            let offset = 1;
            sendUpdate('log', `[Thread ${queryIndex + 1}] Starting search: "${searchTerm.slice(0, 55)}..."`);

            while (collectedLeads.length < targetCount) {
              if (req.signal.aborted) break;
              const searchUrl = `https://search.yahoo.com/search?p=${encodeURIComponent(searchTerm)}&b=${offset}`;

              try {
                await pRetry(() => queryPage.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }), { retries: 2 });
              } catch { break; }

              await queryPage.waitForTimeout(1500 + Math.random() * 1500);

              const results = await queryPage.evaluate(() => {
                const rows = document.querySelectorAll('.compTitle');
                return Array.from(rows).map(row => {
                  const a = row.querySelector('a');
                  const url = a?.href || '';
                  const desc = (row.parentElement?.querySelector('.compText') as HTMLElement)?.innerText || '';

                  // FIX: Read the h3 span text, NOT a.innerText (which includes URL breadcrumbs)
                  // Yahoo structure: .compTitle > a > [breadcrumb div] + h3 > span
                  // The clean title like "Name - Job Title | LinkedIn" is in the h3 span
                  const h3Span = row.querySelector('h3 span');
                  const titleRaw = h3Span?.textContent?.trim() || a?.innerText?.split('\n').pop()?.trim() || '';

                  // Strip trailing " | LinkedIn"
                  let cleanText = titleRaw.replace(/\s*[|•]\s*LinkedIn.*$/i, '').trim();

                  // Split on " - " or " | " separators
                  const parts = cleanText.split(/\s*[-|]{1,2}\s*/);
                  const name = (parts[0] || 'Unknown').trim();
                  let jobTitle = (parts[1] || 'Unknown').trim();
                  let company = 'Unknown';

                  if (parts.length > 2) {
                    company = parts[2].trim();
                  } else if (jobTitle.includes(' @ ')) {
                    const s = jobTitle.split(' @ ');
                    jobTitle = s[0].trim();
                    company = s[1].trim();
                  } else if (jobTitle.toLowerCase().includes(' at ')) {
                    const s = jobTitle.split(/\s+at\s+/i);
                    jobTitle = s[0].trim();
                    company = s[s.length - 1].trim();
                  }

                  return { url, name, title: jobTitle, company, bio: desc };
                }).filter(r => {
                  const u = r.url.toLowerCase();
                  // Block foreign country subdomains (ca., be., uk., de., fr., etc.)
                  const isForeignSubdomain = /https?:\/\/(?!in\.|www\.)[a-z]{2,3}\.linkedin\.com\//i.test(u);
                  return u.includes('linkedin.com/in') && !isForeignSubdomain;
                });
              });

              // Update raw scanned count live
              totalScrapedRawLeads += results.length;
              sendStats(); // <-- Send live stats update on every page scan

              if (results.length === 0) {
                sendUpdate('log', `[Thread ${queryIndex + 1}] Results exhausted.`);
                break;
              }

              for (const lead of results) {
                if (collectedLeads.length >= targetCount || req.signal.aborted) break;
                const cleanUrl = lead.url.split('?')[0].replace(/\/$/, "").toLowerCase();
                const handle = getHandle(cleanUrl);
                const fullText = `${lead.name} ${lead.title} ${lead.bio}`.toLowerCase();

                const auditPath = path.join(process.cwd(), 'crawled_audit.csv');
                const dateStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
                const safeString = (str: string) => (str || "").replace(/"/g, '""');

                // Write header if not exists
                if (!fs.existsSync(auditPath)) {
                  fs.writeFileSync(auditPath, "Date,URL,Name,Title,Status,Reason\n");
                }

                // DYNAMIC DEDUPLICATION
                const alreadyFound = collectedLeads.some(l => l.url.toLowerCase().includes(cleanUrl)) ||
                  exclusionSet.has(handle) ||
                  exclusionSet.has(cleanUrl);

                if (alreadyFound) {
                  totalRejected++;
                  sendStats();
                  fs.appendFileSync(auditPath, `"${dateStr}","${cleanUrl}","${safeString(lead.name)}","${safeString(lead.title)}","REJECTED","Duplicate"\n`);
                  continue;
                }

                // ICP FILTER — dynamically adapted to user query + industry
                const userQueryLowerICP = query.toLowerCase();
                const isGMQueryICP = /general\s*manager|\bgm\b|\bvp\b|vice\s*president|head\s*of|director|chief/.test(userQueryLowerICP);
                const isBrandingQueryICP = /brand(ing)?|brand\s*manager|brand\s*head|brand\s*marketing/.test(userQueryLowerICP);
                const isBTLQueryICP = /btl|activation|trade\s*marketing|offline\s*marketing|experiential/.test(userQueryLowerICP);

                // Industry keyword matchers
                const industryKeywords: Record<string, RegExp> = {
                  alcohol: /\b(alcohol|liquor|spirits|whisky|whiskey|scotch|beer|wine|vodka|gin|rum|alco|diageo|united\s*spirits|abinbev|pernod|radico|sula|carlsberg|heineken|bacardi|beam|suntory|tilaknagar|allied\s*blenders|globus|john\s*distill|molson|coors|brewery|breweries|distillery|winery|alcopop|brewer|malted|malt)\b/i,
                  pharma: /\b(pharma|pharmaceutical|medicine|drug|healthcare|biotech|clinic|sun\s*pharma|cipla|lupin|zydus|mankind|dr\s*reddy|Abbott|pfizer|gsk|novartis|torrent|aurobindo|alkem|ipca)\b/i,
                  auto: /\b(automobile|automotive|car|vehicle|motorbike|motor|maruti|tata\s*motors|mahindra|hyundai|honda|toyota|kia|royal\s*enfield|ev|electric\s*vehicle)\b/i,
                  ecommerce: /\b(ecommerce|e-commerce|online\s*retail|marketplace|flipkart|amazon|meesho|nykaa|myntra|blinkit|swiggy|zomato|bigbasket)\b/i,
                  telecom: /\b(telecom|telecommunication|mobile\s*network|airtel|jio|vodafone|bsnl)\b/i,
                  finance: /\b(banking|finance|insurance|fintech|nbfc|lending|hdfc\s*bank|icici\s*bank|sbi|axis\s*bank|kotak|bajaj\s*finance|indusind)\b/i,
                  realestate: /\b(real\s*estate|property|housing|realty|construction|dlf|lodha|prestige|brigade|sobha|godrej\s*properties)\b/i,
                  food: /\b(food|snack|beverage|restaurant|qsr|haldirams|bikaji|mtr\s*foods|cargill)\b/i,
                  beauty: /\b(beauty|cosmetic|skincare|grooming|personal\s*care|lakme|mamaearth|nykaa|sugar\s*cosmetics|plum|biotique)\b/i,
                  fmcg: /\b(fmcg|consumer\s*goods|packaged\s*goods|hindustan\s*unilever|hul|itc|marico|dabur|godrej|emami|nestle|britannia|parle|amul|reckitt)\b/i,
                };

                const hasIndustrySignal = detectedIndustry && industryKeywords[detectedIndustry]
                  ? industryKeywords[detectedIndustry].test(fullText)
                  : true; // no industry filter → always passes

                // Build role/brand relevance check
                let carriesRelevant: boolean;
                if (isGMQueryICP && isBrandingQueryICP) {
                  const hasBrand = /\b(brand|branding|brand\s*management|brand\s*strategy|brand\s*marketing|brand\s*portfolio|marketing\s*head|brand\s*building)\b/i.test(fullText);
                  const hasSeniority = /\b(general\s*manager|\bgm\b|head\s*of|director|\bvp\b|vice\s*president|chief|national\s*manager|zonal\s*head|regional\s*head|senior\s*manager|president|partner)\b/i.test(fullText);
                  carriesRelevant = (hasBrand || hasSeniority) && hasIndustrySignal;
                } else if (isGMQueryICP) {
                  const hasSeniority = /\b(general\s*manager|\bgm\b|head\s*of|director|\bvp\b|vice\s*president|chief|national\s*manager|senior\s*manager|president)\b/i.test(fullText);
                  carriesRelevant = hasSeniority && hasIndustrySignal;
                } else if (isBrandingQueryICP) {
                  const hasBrand = /\b(brand|branding|brand\s*management|brand\s*strategy|brand\s*marketing)\b/i.test(fullText);
                  carriesRelevant = hasBrand && hasIndustrySignal;
                } else {
                  // Default: BTL/offline keywords + industry signal
                  const hasBTL = /\b(btl|offline|activation|experiential|trade\s*marketing|event|brand|merchandising|rural|field\s*marketing|promotion)\b/i.test(fullText);
                  carriesRelevant = hasBTL && hasIndustrySignal;
                }

                const isDigital = /\b(digital\s*marketing|seo|ppc|developer|software|social\s*media\s*marketing\s*agency|web\s*developer)\b/i.test(fullText);
                const foreignLocationMatch = fullText.match(/\b(united\s*states|usa|canada|uk|united\s*kingdom|australia|germany|france|belgium|uae|dubai|singapore|qatar|kuwait|pakistan|marietta|auburn)\b/i);
                const isIndiaMatch = /\b(india|delhi|mumbai|bangalore|bengaluru|pune|hyderabad|chennai|kolkata|gurgaon|noida|ahmedabad|jaipur|lucknow|indore|bhopal|chandigarh|nagpur|surat|kochi|coimbatore|vadodara|patna|rajkot|goa|bhubaneswar|raipur|mysore|guwahati|amritsar|agra|varanasi|jodhpur|vizag|visakhapatnam)\b/i.test(fullText);
                const isNonIndiaSubdomain = !cleanUrl.includes('in.linkedin.com');

                let status = "KEPT";
                let reason = "ICP Match";

                if (isDigital) { status = "REJECTED"; reason = "Digital Marketing Filter"; }
                else if (!carriesRelevant) { status = "REJECTED"; reason = "No Relevant Keywords for Query"; }
                else if (foreignLocationMatch && !isIndiaMatch) { status = "REJECTED"; reason = "Foreign Location"; }
                else if (isNonIndiaSubdomain && !isIndiaMatch) { status = "REJECTED"; reason = "No India Location Signal"; }
                else if (cleanUrl.match(/https?:\/\/(?!in\.|www\.)[a-z]{2}\.linkedin\.com/i)) { status = "REJECTED"; reason = "Non-India Subdomain"; }

                if (status === "REJECTED") {
                  totalRejected++;
                  sendStats();
                  fs.appendFileSync(auditPath, `"${dateStr}","${cleanUrl}","${safeString(lead.name)}","${safeString(lead.title)}","${status}","${reason}"\n`);
                  continue;
                }

                // --- PERSISTENCE & UNIQUE LOCK --- //
                let isFresh = false;
                try {
                  db.prepare(`
                    INSERT INTO leads (url, name, job_title, company, location, bio)
                    VALUES (?, ?, ?, ?, ?, ?)
                  `).run(cleanUrl, lead.name, lead.title, lead.company || "Unknown", "India", lead.bio);
                  isFresh = true;
                } catch (err: any) {
                  if (err.message.includes('UNIQUE constraint failed')) { isFresh = false; } else { isFresh = true; }
                }

                if (!isFresh) {
                  totalRejected++;
                  sendStats();
                  fs.appendFileSync(auditPath, `"${dateStr}","${cleanUrl}","${safeString(lead.name)}","${safeString(lead.title)}","REJECTED","DB Duplicate"\n`);
                  continue;
                }

                // Log KEPT lead to audit
                fs.appendFileSync(auditPath, `"${dateStr}","${cleanUrl}","${safeString(lead.name)}","${safeString(lead.title)}","KEPT","Fresh ICP Match"\n`);

                exclusionSet.add(cleanUrl);
                exclusionSet.add(handle);

                const extracted = { url: lead.url, data: [{ name: lead.name, jobTitle: lead.title, company: lead.company || "Unknown", location: "India", emails: [], rawBio: lead.bio }] };
                collectedLeads.push(extracted);
                sendStats(); // Send stats after each kept lead

                // --- PRIMARY SHEET EXPORT --- //
                try {
                  const csvLine = `"${safeString(lead.name)}","${safeString(lead.title)}","","","","India","${safeString(lead.company || "Unknown")}","","India","","${lead.url}","","${dateStr}","AI WebAgent","Automated X-Ray","","","",\n`;
                  fs.appendFileSync(csvPath, csvLine);
                } catch (err) { }

                sendUpdate('item_extracted', extracted);
              }
              offset += 10;
              if (offset > 100 || collectedLeads.length >= targetCount) break;
            }
            await queryPage.close();
          });

          await Promise.allSettled(searchTasks);
        }
      } catch (err) {
        sendUpdate('error', String(err));
      } finally {
        const totalRejectedFinal = totalScrapedRawLeads - collectedLeads.length;
        const allTimeRow = db.prepare('SELECT SUM(cost_usd) as total FROM cost_log').get() as any;
        const allTimeCost = allTimeRow?.total ?? 0;
        sendUpdate('log', `--- FINAL REPORT ---`);
        sendUpdate('log', `Found: ${totalScrapedRawLeads} | Kept: ${collectedLeads.length} | Rejected: ${Math.max(0, totalRejectedFinal)}`);
        sendUpdate('log', `This Run Cost: $${sessionTotalCost.toFixed(5)} | All-Time Total: $${Number(allTimeCost).toFixed(5)}`);
        sendUpdate('cost_update', { totalCost: sessionTotalCost, lastCallCost: 0, allTimeCost });
        sendUpdate('done', collectedLeads);
        if (browser) await browser.close();
        controller.close();
      }
    }
  });

  return new NextResponse(readable, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
  });
}
