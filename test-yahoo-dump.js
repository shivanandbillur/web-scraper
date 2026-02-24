const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://search.yahoo.com/search?p=site:linkedin.com/in/+btl+manager+india', { waitUntil: 'domcontentloaded' });
    const items = await page.evaluate(() => {
        const rows = document.querySelectorAll('.compTitle');
        return Array.from(rows).map(row => {
            const a = row.querySelector('a');
            return {
                url: a ? a.href : '',
                title: a ? a.innerText : '',
                html: a ? a.innerHTML : ''
            };
        });
    });
    fs.writeFileSync('yahoo-dump.json', JSON.stringify(items, null, 2));
    await browser.close();
})();
