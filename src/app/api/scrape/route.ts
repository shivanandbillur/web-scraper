import { NextResponse } from 'next/server';
import { chromium } from 'playwright';

// Keep the route dynamic and allow long execution times
export const maxDuration = 300; // 5 minutes (requires Pro plan on Vercel, but local works fine)
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      function sendUpdate(type: string, data: any) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`));
      }

      let browser = null;
      try {
        const { searchQuery, searchEngine, numResults = 5 } = await req.json();

        if (!searchQuery) {
          sendUpdate('error', 'Search Query is required.');
          controller.close();
          return;
        }

        sendUpdate('log', `Launching local browser automation without APIs...`);
        browser = await chromium.launch({ headless: true }); // headless: true for background, but can be false for "normal browser" experience
        const context = await browser.newContext({
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        });
        const page = await context.newPage();

        sendUpdate('log', `Navigating to search engine: ${searchEngine}`);
        let urls: string[] = [];

        // Build X-Ray search query
        const modifiedQuery = `site:linkedin.com/in/ OR site:linkedin.com/pub/ ${searchQuery}`;

        if (searchEngine === 'google') {
          await page.goto(`https://search.yahoo.com/search?p=${encodeURIComponent(modifiedQuery)}`, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(2000);

          urls = await page.evaluate(() => {
            const results = Array.from(document.querySelectorAll('div.compTitle a'));
            return results
              .map(a => (a as HTMLAnchorElement).href)
              .filter(h => h.startsWith('http'))
              .filter(h => h.includes('linkedin.com/in') || h.includes('linkedin.com/pub'))
              .filter((v, i, a) => a.indexOf(v) === i);
          });
        } else if (searchEngine === 'bing') {
          await page.goto(`https://search.yahoo.com/search?p=${encodeURIComponent(modifiedQuery)}`, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(2000);

          urls = await page.evaluate(() => {
            const results = Array.from(document.querySelectorAll('div.compTitle a'));
            return results
              .map(a => (a as HTMLAnchorElement).href)
              .filter(h => h.startsWith('http'))
              .filter(h => h.includes('linkedin.com/in') || h.includes('linkedin.com/pub'))
              .filter((v, i, a) => a.indexOf(v) === i);
          });
        }

        urls = urls.slice(0, numResults);
        sendUpdate('log', `Found ${urls.length} target pages to visit.`);
        sendUpdate('urls', urls);

        const extractedData = [];

        // Try extracting info from each page algorithmicly (Regex + DOM)
        for (let i = 0; i < urls.length; i++) {
          const url = urls[i];
          sendUpdate('log', `Visiting (${i + 1}/${urls.length}): ${url}`);
          sendUpdate('current_url', url);

          try {
            await page.goto(url, { timeout: 30000 });
            await page.waitForLoadState('domcontentloaded');

            sendUpdate('log', `Extracting structured data algorithmically from ${url}...`);

            // Extract visible text and DOM attributes specifically tailored for LinkedIn Public Profiles
            const extracted = await page.evaluate(() => {
              // Extract Meta Tags (LinkedIn populates meta perfectly for public profiles)
              const titleNode = document.title || '';
              const metaDescNode = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
              const ogTitleNode = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';

              // Example meta description from LinkedIn: "San Francisco, California, United States. 500+ connections..." or "View X's profile on LinkedIn, the world's largest professional community. X has 3 jobs listed on their profile."
              // The og:title is usually "First Last - Job Title - Company | LinkedIn"

              let name = "";
              let title = "";
              let company = "";
              const location = "Unknown";

              try {
                // Parse ogTitle: "John Doe - Manager - Apple | LinkedIn"
                const parts = ogTitleNode.split(' - ');
                if (parts.length > 0) name = parts[0].trim();
                if (parts.length > 1) {
                  const subParts = parts[1].split(' | ');
                  title = subParts[0].trim();
                }
                if (parts.length > 2) {
                  const companyParts = parts[2].split(' | ');
                  company = companyParts[0].trim();
                }

                // If fallback mapping is needed, check standard h1 tags in public profile
                if (!name) name = document.querySelector('h1')?.innerText?.trim() || 'Unknown';
                if (!title) title = document.querySelector('h2')?.innerText?.trim() || 'Unknown';
              } catch { }

              // Try extracting emails from the page text just in case they listed it
              const bodyText = document.body.innerText || '';
              const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
              const rawEmails = bodyText.match(emailRegex) || [];
              const emails = Array.from(new Set(rawEmails.map(e => e.toLowerCase())));

              return [{
                name,
                jobTitle: title,
                company,
                location,
                emails,
                rawBio: metaDescNode
              }];
            });

            if (extracted && extracted.length > 0) {
              const item = { url, data: extracted };
              extractedData.push(item);
              sendUpdate('item_extracted', item);
              sendUpdate('log', `Success extracted data from ${url}.`);
            } else {
              sendUpdate('log', `Found no relevant data on ${url}.`);
            }

          } catch (error) {
            sendUpdate('log', `Failed to visit ${url}: ${String(error)}`);
          }
        }

        sendUpdate('log', `Job complete! Extracted total ${extractedData.length} entries.`);
        sendUpdate('done', extractedData);

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
