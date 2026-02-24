const fs = require('fs');
const content = fs.readFileSync('leadsc - sheet1 (1).csv', 'utf-8');
const m1 = content.match(/https?:\/\/[a-z]{0,3}\.?linkedin\.com\/in\/[^\s",]+/gi);
const m2 = content.match(/(?:https?:\/\/)?(?:[a-z]{0,3}\.)?linkedin\.com\/(?:in|pub)\/[^\s",?\/]+/gi);

const names = [];
const lines = content.split('\n');
for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const firstCol = line.split(',')[0];
    if (firstCol) {
        const name = firstCol.replace(/"/g, '').trim().toLowerCase();
        if (name && name.length > 3) names.push(name);
    }
}

console.log('m1 len:', m1 ? m1.length : 0, 'm2 len:', m2 ? m2.length : 0, 'names len:', names.length);
