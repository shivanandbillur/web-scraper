const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://search.yahoo.com/search?p=site:linkedin.com/in/+btl+manager+india', { waitUntil: 'domcontentloaded' });
    const items = await page.evaluate(() => {
        const rows = document.querySelectorAll('.compTitle');
        return Array.from(rows).map(row => {
            const a = row.querySelector('a');
            const url = a ? a.href : '';
            const title = a ? a.innerText : '';
            const parent = row.parentElement;
            const descNode = parent?.querySelector('.compText');
            const desc = descNode ? descNode.innerText : '';
            return { url, title, desc };
        });
    });
    console.log("Found Results:", items);
    await browser.close();
})();
