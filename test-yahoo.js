const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://search.yahoo.com/search?p=web+design+london', { waitUntil: 'domcontentloaded' });
    const items = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('div.compTitle a')).map(a => a.href);
    });
    console.log("Yahoo compTitle:", items);
    await browser.close();
})();
