import {createRequire} from 'module';
const require=createRequire('/home/box/tools/mg-styles-15/package.json');
const puppeteer=require('puppeteer-core');
const [,, w='1920', h='1080', lang='en', out='shots/test.png', hub=''] = process.argv;
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--hide-scrollbars=false']});
const p=await b.newPage();await p.setViewport({width:+w,height:+h});
const errs=[];p.on('console',m=>{if(['error','warning'].includes(m.type()))errs.push(m.type()+': '+m.text())});p.on('requestfailed',r=>errs.push('fail '+r.url()));p.on('response',r=>{if(r.status()>=400)errs.push(r.status()+' '+r.url())});p.on('pageerror',e=>errs.push('pageerror: '+e.message));
await p.evaluateOnNewDocument(l=>{try{localStorage.setItem('dfly-lang',l)}catch(e){}},lang);
await p.goto((process.env.URL||'http://127.0.0.1:47391/'),{waitUntil:'networkidle0'});
await new Promise(r=>setTimeout(r,6000));
if(hub){await p.evaluate(c=>window.DFLY_GLOBE.select(c),hub);await new Promise(r=>setTimeout(r,800));}
const chk=await p.evaluate(()=>{
  const de=document.documentElement;const res={scroll:[de.scrollWidth,de.clientWidth,de.scrollHeight,de.clientHeight]};
  const bad=[];
  document.querySelectorAll('.panel *, #hdr *, .center *').forEach(e=>{
    if(e.closest('.loop')||e.closest('svg')||e.closest('.hub-layer'))return;
    const cs=getComputedStyle(e);if(cs.display==='none')return;
    if(e.scrollWidth>e.clientWidth+1 && cs.overflow!=='visible' && e.clientWidth>0) bad.push('hov '+(e.id||e.className)+' '+e.scrollWidth+'>'+e.clientWidth+' '+e.textContent.slice(0,30));
  });
  document.querySelectorAll('.panel').forEach(pn=>{const pr=pn.getBoundingClientRect();pn.querySelectorAll('.pb > *').forEach(c=>{const r=c.getBoundingClientRect();if(r.bottom>pr.bottom+0.5||r.right>pr.right+0.5)bad.push('clip '+pn.id+' '+(c.id||c.className)+' '+Math.round(r.bottom-pr.bottom)+'/'+Math.round(r.right-pr.right));});});
  res.bad=bad;return res;});
console.log(JSON.stringify(chk));console.log(errs.join('\n'));
await p.screenshot({path:out,fullPage:process.env.FULL==='1'});
await b.close();
