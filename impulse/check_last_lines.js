const fs=require('fs');
const s=fs.readFileSync('web/src/pages/AdminPortalPage.jsx','utf8').split('\n');
let lastP=0,lastC=0;
for(let i=0;i<s.length;i++){
  if(s[i].includes('(')) lastP=i+1;
  if(s[i].includes('{')) lastC=i+1;
}
console.log('last line with (',lastP); console.log('last line with {',lastC);
