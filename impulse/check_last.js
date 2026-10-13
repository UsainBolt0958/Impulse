const fs=require('fs');
const s=fs.readFileSync('web/src/pages/AdminPortalPage.jsx','utf8');
let lastParen = s.lastIndexOf('(');
let lastBrace = s.lastIndexOf('{');
console.log('lastparen idx',lastParen, 'snippet', s.slice(lastParen-30,lastParen+30));
console.log('lastbrace idx',lastBrace, 'snippet', s.slice(lastBrace-30,lastBrace+30));
