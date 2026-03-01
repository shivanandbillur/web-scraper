const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'data', 'leads.db');
const db = new Database(dbPath);
const queriesCount = db.prepare('SELECT COUNT(*) as count FROM queries').get().count;
const leadsCount = db.prepare('SELECT COUNT(*) as count FROM leads').get().count;
console.log(`Queries: ${queriesCount}, Leads: ${leadsCount}`);
const last5Queries = db.prepare('SELECT query_text FROM queries ORDER BY id DESC LIMIT 5').all();
console.log('Last 5 queries:', last5Queries);
