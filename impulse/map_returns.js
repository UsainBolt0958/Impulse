const fs=require('fs');
const s=fs.readFileSync('web/src/pages/AdminPortalPage.jsx','utf8').split('\n');
let p=0;let returns=[];
for(let i=0;i<s.length;i++){
  const line=s[i];
  for(let ch of line){ if(ch==='(')p++; if(ch===')')p--; }
  if(line.includes('return (')) returns.push({line:i+1,pAtPush:p});
}
console.log('returns:',returns);
for(const r of returns){let p2=0; for(let i=r.line;i<s.length;i++){for(const ch of s[i]){ if(ch==='(')p2++; if(ch===')')p2--; } if(p2===0){console.log('return at',r.line,'closed at',i+1); break;} }
}
