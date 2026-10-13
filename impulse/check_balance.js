const fs=require('fs');
const s=fs.readFileSync('web/src/pages/AdminPortalPage.jsx','utf8').split('\n');
let p=0,c=0;
for(let i=0;i<s.length;i++){
  const line=s[i];
  for(const ch of line){ if(ch==='(')p++; if(ch===')')p--; if(ch==='{')c++; if(ch==='}')c--; }
  if((i+1)===2135){console.log('line',i+1,line); console.log('paren balance',p,'brace balance',c);}
}
console.log('final paren balance',p,'final brace balance',c);
