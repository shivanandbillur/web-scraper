const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://search.yahoo.com/search?p=site:linkedin.com/in/+marketing+manager', { waitUntil: 'domcontentloaded' });
    const items = await page.evaluate(() => {
        const results = Array.from(document.querySelectorAll('.algo-sr')); // Yahoo uses different classes, let's just grab the whole container
        // actually let's try getting all div.compTitle and their siblings
        const rows = document.querySelectorAll('.compTitle');
        return Array.from(rows).map(row => {
            const a = row.querySelector('a');
            const url = a ? a.href : '';
            const title = a ? a.innerText : '';
            // The description is usually in a div with class .compText
            const parent = row.parentElement;
            const descNode = parent?.querySelector('.compText');
            const desc = descNode ? descNode.innerText : '';
            return { url, title, desc };
        });
    });
    console.log("Found Results:", items);
    await browser.close();
})();
