const fs = require('fs');
const path = require('path');

const url = process.env.SUPABASE_URL || '';
const anonKey = process.env.SUPABASE_ANON_KEY || '';

if (!url || !anonKey) {
  console.warn('Warning: SUPABASE_URL and/or SUPABASE_ANON_KEY are not set. The early access form will not work.');
}

const content = `window.__SUPABASE_URL__ = ${JSON.stringify(url)};
window.__SUPABASE_ANON_KEY__ = ${JSON.stringify(anonKey)};
`;

fs.writeFileSync(path.join(__dirname, '..', 'public', 'config.js'), content);
console.log('Wrote public/config.js');
