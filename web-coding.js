(()=>{
 if(globalThis.ccbpWeb)return;
 const text=e=>(e?.innerText||e?.textContent||'').trim();
 const visible=e=>e?.getClientRects().length;
 function tab(name){return [...document.querySelectorAll('button,[role=tab],span,div')].find(e=>visible(e)&&text(e).toUpperCase()===name&&!Array.from(e.children).some(c=>text(c).toUpperCase()===name));}
 const detected=()=>!!tab('HTML')&&!!tab('CSS')&&!!tab('JAVASCRIPT');
 function results(){
  const heading=[...document.querySelectorAll('div,span,h2,h3')].find(e=>visible(e)&&/^Testcases$/i.test(text(e)));
  for(let p=heading?.parentElement;p&&p!==document.body;p=p.parentElement){
   const t=text(p),total=t.match(/Total\s*(\d+)/i),passed=t.match(/Passed\s*(\d+)/i),failed=t.match(/Failed\s*(\d+)/i);
   if(total&&passed&&failed){
    const n=+total[1],yes=+passed[1],no=+failed[1];
    if(!n||yes+no!==n)return null;
    return {total:n,passed:yes,failed:no,feedback:t.slice(0,14000)};
   }
  }
  return null;
 }
 async function start(api){
  const {request,check,sleep,url,problem,panel,limit,setStatus,submit}=api;
  const keys=['html','css','javascript'],original={},current={};
  async function select(key){
   check();const e=tab(key.toUpperCase());if(!e)throw Error('Missing '+key+' tab');
   e.click();await sleep(200);check();
   const value=await request({type:'coding-editor',action:'read',url});
   const pattern=key==='javascript'?/javascript|jsx/:key==='html'?/html/:/css/;
   if(!pattern.test(value.language))throw Error('Editor did not switch to '+key+'; no file overwritten');
   return value.code;
  }
  for(const key of keys)original[key]=current[key]=await select(key);
  sessionStorage.setItem('ccbp-helper-web-backup:'+url,JSON.stringify(original));
  // Keep resource addresses as text; never download or encode design images.
  const resources=[...panel.querySelectorAll('a[href],img[src],video[src],source[src]')].map(e=>e.href||e.currentSrc||e.src).filter(u=>/^https?:\/\//i.test(u));
  const context=problem+'\nResource URLs:\n'+[...new Set(resources)].slice(0,40).join('\n');
  let feedback=results()?.feedback||'';
  for(let attempt=1;attempt<=limit;attempt++){
   check();setStatus('Web coding: generating HTML, CSS and JavaScript ('+attempt+'/'+limit+')');
   const r=await request({type:'coding-generate',input:{kind:'web',problem:context,files:current,feedback}});check();
   if(!r.files||keys.some(k=>typeof r.files[k]!=='string'))throw Error('Model did not return all three web files');
   for(const key of keys){
    const value=await select(key);
    if(value!==current[key])throw Error(key+' changed during generation; stopped to preserve your edits');
    if(r.files[key]!==value)await request({type:'coding-editor',action:'write',url,code:r.files[key],expectedCode:value,allowEmpty:true});
    current[key]=r.files[key];check();
   }
   setStatus('Web coding: submitting and checking tests ('+attempt+'/'+limit+')');
   const result=await submit(results);check();
   if(result.passed===result.total){setStatus('Web coding complete: '+result.passed+'/'+result.total+' tests passed.');return {done:true};}
   feedback=result.feedback;globalThis.ccbpLog?.('Web attempt '+attempt+': '+result.passed+'/'+result.total+' passed. '+feedback);
  }
  setStatus('Web coding attempt limit reached. Skipping this problem.');return {exhausted:true};
 }
 globalThis.ccbpWeb={detected,results,start};
})();

