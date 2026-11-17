(()=>{
 if(globalThis.ccbpMCQ)return;
 let running=false,epoch=0,status='Ready.',outcome=null;
 const visible=e=>!!e&&e.getClientRects().length>0,text=e=>(e?.innerText||e?.textContent||'').trim(),sleep=ms=>new Promise(r=>setTimeout(r,ms));

 function button(name){
  const reg=new RegExp('^\\s*(?:▶\\s*)?'+name+'(?:\\s*ANSWER)?\\s*$','i');
  return [...document.querySelectorAll('button, [role="button"]')].find(e=>
   visible(e)&&(reg.test(text(e))||new RegExp('^'+name,'i').test(text(e)))
  );
 }

 const isCodingActive=()=>{
  if(/\/(?:question|default-question)\//i.test(location.pathname))return true;
  if(document.getElementById('runCode')||document.getElementById('submitCode'))return true;
  const buttons=[...document.querySelectorAll('button,[role=button]')].filter(visible);
  if(buttons.some(b=>/run\s*code|submit\s*code/i.test(text(b))))return true;
  if(document.getElementById('codingQuestionEditor')&&buttons.some(b=>/run|submit|test/i.test(text(b))))return true;
  if(globalThis.ccbpWeb?.detected?.())return true;
  return false;
 };

 const detected=()=>{
  // Coding routes are NEVER MCQ
  if(/\/(?:question|default-question)\//i.test(location.pathname))return false;
  if(isCodingActive())return false;
  // The initial start/restart practice intro screen is not an active question screen
  const start=button('START')||button('RESTART');
  if(start&&visible(start))return false;
  // Active MCQ question has a SUBMIT or NEXT button and readable options/text field
  if(button('SUBMIT')||button('NEXT')){
   try{
    const q=read();
    return !!q&&(!!q.field||q.rows.length>=2);
   }catch{
    return false;
   }
  }
  return false;
 };

 function container(){
  const generic=document.getElementById('generic-question-container');
  if(generic&&visible(generic))return generic;

  const submit=button('SUBMIT');
  const textInput=[...document.querySelectorAll('textarea, input')].find(e=>visible(e)&&/enter your answer|answer/i.test(e.placeholder||''));

  let startNode=textInput||submit;
  if(!startNode)return document.body;

  let current=startNode;
  while(current&&current!==document.body){
   const hasSubmit=submit&&current.contains(submit);
   const hasTextInput=textInput&&current.contains(textInput);
   const radioCount=current.querySelectorAll('input[type=radio], input[type=checkbox], [role=radio], [role=checkbox]').length;
   const labelCount=current.querySelectorAll('label').length;

   const iconChoices=[...current.querySelectorAll('svg,img')].filter(e=>visible(e)&&!e.closest('button,.ace_editor')&&e.getBoundingClientRect().width<=40).length;
   if(hasSubmit&&(hasTextInput||radioCount>=2||labelCount>=2||iconChoices>=2)){
    return current;
   }
   current=current.parentElement;
  }
  return document.body;
 }

 function clickElement(el){
  if(!el)return;
  try{el.scrollIntoView({block:'center',inline:'center'});}catch{}
  if(typeof el.click==='function'){
   el.click();
  }else{
   el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
  }
 }

 function read(){
  const c=container();
  const field=[...c.querySelectorAll('textarea,input[type=text],input:not([type])')].find(e=>visible(e)&&/answer/i.test(e.placeholder||''));
  const multiple=!!c.querySelector('input[type=checkbox],[role=checkbox]');
  
  let controls=[...c.querySelectorAll(multiple?'input[type=checkbox],[role=checkbox]':'input[type=radio],[role=radio]')].filter(e=>visible(e)||visible(e.closest('label')));
  let rows=controls.map(e=>{
   let p=e.closest('label')||e.parentElement;
   for(let i=0;i<3&&p&&!text(p)&&!p.querySelector('img');i++)p=p.parentElement;
   return {el:e,row:p,label:text(p)};
  });

  if(!field&&!rows.length){
   const labels=[...c.querySelectorAll('label')].filter(e=>visible(e)&&(text(e).length>0||e.querySelector('img'))&&text(e).length<1500);
   if(labels.length>=2&&labels.length<=12){
    rows=labels.map(lbl=>{
     const input=lbl.querySelector('input')||lbl;
     return {el:input,row:lbl,label:text(lbl)};
    });
   }
  }

  if(!field&&!rows.length&&c!==document.body){
   rows=[...c.querySelectorAll('svg,img')].filter(visible).map(e=>{
    if(e.closest('button,.ace_editor'))return {label:''};
    let p=e.parentElement;
    for(let i=0;i<3&&p&&!text(p);i++)p=p.parentElement;
    return {el:p,row:p,label:text(p)};
   }).filter(r=>r.row&&!r.row.querySelector('button')&&(r.label||r.row.querySelector('img'))&&r.label.length<1500);
  }

  rows=rows.filter((r,i,a)=>(r.label||r.row?.querySelector('img'))&&a.findIndex(x=>x.row===r.row)===i);
  rows.forEach((r,i)=>{if(!r.label)r.label='[Image option '+i+']';});
  if(!field&&(rows.length<2||rows.length>12))throw Error('Cannot identify answer controls');

  let question='';
  try{
   const range=document.createRange();
   range.selectNodeContents(c);
   range.setEndBefore(field||rows[0].row);
   question=range.toString().trim();
  }catch{}

  if(!question){
   const fullText=text(c);
   const firstOption=rows[0]?.label||'';
   if(firstOption&&fullText.includes(firstOption)){
    question=fullText.split(firstOption)[0].trim();
   }else{
    question=fullText.slice(0,1500).trim();
   }
  }
  if(!question)throw Error('Question text missing');

  const options=rows.map(r=>r.label),kind=field?'text':'options';
  const imageEntries=[];
  if(globalThis.ccbpAssets){
   for(const image of ccbpAssets.images(c)){
    const index=rows.findIndex(r=>r.row.contains(image));
    if(index>=0)imageEntries.push({image,label:'Option '+index+' image'});
   }
  }
  return {question,options,multiple,kind,rows,field,imageEntries,key:JSON.stringify({question,options,multiple,kind,images:imageEntries.map(e=>[e.label,e.image.currentSrc||e.image.src])})};
 }

 async function code(){
  try{
   const r=await chrome.runtime.sendMessage({type:'mcq-code',url:location.href});
   if(r?.error)throw Error(r.error);
   return r?.code||'';
  }catch(e){throw Error('Could not read code context: '+e.message);}
 }

 function checked(el){
  if(el.matches('input'))return el.checked;
  const v=el.getAttribute('aria-checked');
  if(v==='true')return true;
  if(v==='false')return false;
  throw Error('Cannot read checkbox state');
 }

 function check(t,url){
  if(t!==epoch)throw Error('Stopped');
  if(location.href!==url)throw Error('Question page changed');
 }

 async function select(q,a,t,url){
  if(q.kind==='text'){
   const proto=q.field.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
   Object.getOwnPropertyDescriptor(proto,'value').set.call(q.field,a);
   q.field.dispatchEvent(new Event('input',{bubbles:true}));
   q.field.dispatchEvent(new Event('change',{bubbles:true}));
   if(q.field.value!==a)throw Error('Text answer did not persist');
   return;
  }
  if(!q.multiple){
   const target=q.rows[a[0]]?.el;
   const parentRow=q.rows[a[0]]?.row;
   clickElement(target);
   if(parentRow&&parentRow!==target){
    clickElement(parentRow);
   }
   return;
  }
  for(let i=0;i<q.rows.length;i++){
   check(t,url);
   const fresh=read();
   if(fresh.key!==q.key)throw Error('Question changed while selecting answers');
   if(checked(fresh.rows[i].el)!==a.includes(i)){
    clickElement(fresh.rows[i].el);

    await sleep(120);
   }
  }
  const final=read();
  if(final.key!==q.key||final.rows.some((r,i)=>checked(r.el)!==a.includes(i)))throw Error('Selected answers did not match the model answer');
 }

 async function wait(fn,t,maxMs=18000){
  // Poll until fn() returns true or maxMs elapses. Default 18s is enough for
  // normal page transitions; callers that wait for a slow model pass a longer value.
  const end=Date.now()+maxMs;
  while(Date.now()<end){
   if(t!==epoch)throw Error('Stopped');
   if(await fn())return;
   await sleep(50);
  }
  throw Error('Page did not advance after '+Math.round(maxMs/1000)+'s; stopped to prevent duplicate submission.');
 }

 async function start(){
  if(running)return;
  running=true;
  outcome=null;
  const t=++epoch;
  let count=0;
  try{
   const s=await Helper.settings();
   while(t===epoch){
    const url=location.href;
    status='Waiting for question and answer controls…';
    await wait(()=>{try{return !!button('SUBMIT')&&!!read();}catch{return false;}},t);
    check(t,url);
    const q=read();
    q.code=await code();
    if(q.options.some(o=>/^\[Image option/.test(o))&&!q.imageEntries.length)throw Error('Image options have not loaded; cannot answer without them.');
    q.images=q.imageEntries.length?await ccbpAssets.collect(q.imageEntries):[];
    check(t,url);
    if(/(?:given|following|python)\s+code|output.*code/i.test(q.question)&&!q.code.trim())throw Error('This question refers to code, but no code was extracted. Stopped before guessing.');
    globalThis.ccbpLog?.('Question context: '+JSON.stringify({question:q.question,code:q.code,options:q.options}));
    
    status=`MCQ: ${count} submitted. Solving: ${q.question.slice(0,50)}…`;
    // Live ticker — shows elapsed seconds so user knows it's active, not frozen.
    const _solveStart=Date.now();
    const _solveTicker=setInterval(()=>{const e=Math.round((Date.now()-_solveStart)/1000);status=`MCQ: ${count} submitted. ${s.thinking ? 'Thinking' : 'Solving'}… ${e}s`;},1000);
    let r;
    try{r=await chrome.runtime.sendMessage({
     type:'solve',
     question:q.question,
     options:q.options,
     multiple:q.multiple,
     kind:q.kind,
     code:q.code,images:q.images
    });}finally{clearInterval(_solveTicker);}
    check(t,url);
    if(r.error)throw Error(r.error);
    
    if(read().key!==q.key||await code()!==q.code)throw Error('Question changed during generation');
    check(t,url);
    globalThis.ccbpLog?.('Votes: '+(r.votes||[]).map(Helper.canonical).join(' | '));
    if(r.traces?.some(Boolean))globalThis.ccbpLog?.('Code traces: '+JSON.stringify(r.traces));
    await select(q,r.answers,t,url);
    await sleep(Math.min(s.delay||80,80));
    check(t,url);
    if(read().key!==q.key)throw Error('Question changed before submission');
    
    const submit=button('SUBMIT');
    if(!submit||submit.disabled)throw Error('Submit unavailable');
    clickElement(submit);
    
    let missing=0;
    const gone=()=>{
     if(button('PROCEED')||button('DONE'))return true;
     if(button('NEXT')||button('SUBMIT')){missing=0;return false;}
     missing ||= Date.now();
     return Date.now()-missing>5000;
    };
    await wait(()=>button('NEXT')||gone(),t,12000);
    count++;
    if(gone()){outcome={done:true};break;}
    
    const next=button('NEXT');
    if(!next||next.disabled)throw Error('Next unavailable');
    clickElement(next);
    
    await wait(async()=>{
     try{
      return (button('SUBMIT')&&(location.href!==url||read().key!==q.key||await code()!==q.code))||gone();
     }catch{
      return gone();
     }
    },t,12000);
    if(gone()){outcome={done:true};break;}
   }
   status=`MCQ screen ended. Submitted ${count} answers.`;
   return outcome||{stopped:true};
  }catch(e){
   status=e.message;
   outcome=/^Image/i.test(e.message)?{skipped:true,reason:e.message}:{error:e.message};
   return outcome;
  }finally{
   if(t===epoch)running=false;
  }
 }

 globalThis.ccbpMCQ={
  detected,
  start,
  read,
  status:()=>status,
  running:()=>running,
  stop:()=>{
   epoch++;
   running=false;
   status='Stopped';
   void chrome.runtime.sendMessage({type:'cancel-model'});
  }
 };
})();
