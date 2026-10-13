const fs=require('fs');
const s=fs.readFileSync('web/src/pages/AdminPortalPage.jsx','utf8').split('\n');
let p=0,c=0;let maxP={v:0,line:0}, maxC={v:0,line:0};
for(let i=0;i<s.length;i++){
  const line=s[i];
  for(const ch of line){ if(ch==='(')p++; if(ch===')')p--; if(ch==='{')c++; if(ch==='}')c--; if(p>maxP.v){maxP.v=p; maxP.line=i+1;} if(c>maxC.v){maxC.v=c; maxC.line=i+1;} }
}
console.log('max paren balance',maxP.v,'at line',maxP.line);
console.log('max brace balance',maxC.v,'at line',maxC.line);
