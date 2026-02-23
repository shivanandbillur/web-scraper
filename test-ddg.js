const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://html.duckduckgo.com/html/?q=web+design+london', { waitUntil: 'domcontentloaded' });
    const items = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a.result__url')).map(a => a.href);
    });
    console.log("Found DuckDuckGo URLs:", items);
    await browser.close();
})();
