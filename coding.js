(()=>{
 if(globalThis.ccbpCoding)return;
 const visible=e=>e&&e.getClientRects().length>0;
 const text=e=>(e?.innerText||e?.textContent||'').trim();
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 let running=false,epoch=0,status='Ready for coding practice.',submitted=false;
 
 async function request(msg){
  const r=await chrome.runtime.sendMessage(msg);
  if(r?.error)throw Error(r.error);
  if(!r)throw Error('No extension response');
  return r;
 }
 
 function check(token,url){
  if(token!==epoch)throw Error('Stopped');
  if(location.href!==url)throw Error('Question changed. Press Start on the new question.');
 }
 
 function leftPanel(){
  const desc=document.getElementById('DESCRIPTION');
  if(desc){
   let el=desc.parentElement;
   while(el&&el!==document.body){
    if(!el.querySelector('#codingQuestionEditor')&&el.getBoundingClientRect().height>200&&(el.querySelector('#SUBMISSION')||/input|output|constraints|instructions|design|refer to/i.test(text(el))))return el;
    el=el.parentElement;
   }
   if(desc.parentElement)return desc.parentElement;
  }
  const panels=[...document.querySelectorAll('div, section, article')].filter(el=>
   visible(el)&&!el.querySelector('#codingQuestionEditor')&&!el.querySelector('.ace_editor')&&
   el.getBoundingClientRect().left<innerWidth*0.55&&el.getBoundingClientRect().width>innerWidth*0.25&&
   el.getBoundingClientRect().height>200
  );
  if(!panels.length)throw Error('Problem panel not recognized');
  return panels[0];
 }

 function testcasePanel(){
  const headings=[...document.querySelectorAll('button, div, span, h2, h3, h4')].filter(e=>
   visible(e)&&/^\s*(?:\{?v\}?\s*)?Testcase\s*$/i.test(text(e))
  );
  if(headings.length){
   let el=headings[0];
   while(el&&el!==document.body){
    if(el.getBoundingClientRect().height>100&&el.getBoundingClientRect().top>innerHeight*0.35&&/Case\s*\d|Errors\/Warnings|Your Output|Expected/i.test(text(el))){
     return el;
    }
    el=el.parentElement;
   }
  }
  const panels=[...document.querySelectorAll('div, section')].filter(el=>
   visible(el)&&!el.querySelector('#codingQuestionEditor')&&!el.querySelector('.ace_editor')&&
   el.getBoundingClientRect().left>innerWidth*0.45&&el.getBoundingClientRect().top>innerHeight*0.4
  );
  if(!panels.length)throw Error('Test result panel not recognized');
  return panels[0];
 }

 function cases(){
  const panel=testcasePanel();
  return [...panel.querySelectorAll('button, [role="tab"], div, span')].filter(e=>
   visible(e)&&/^Case\s*\d+/i.test(text(e))&&!Array.from(e.children).some(c=>/^Case\s*\d+/i.test(text(c)))
  ).map(e=>{
   // The label span and the status icon are siblings inside the tab wrapper.
   let p=e;
   for(let n=0;n<3&&p.parentElement&&/^Case\s*\d+\s*$/i.test(text(p.parentElement));n++)p=p.parentElement;
   return p;
  }).filter((e,i,a)=>a.indexOf(e)===i);
 }

 function clickControl(el){
  if(!el||el.disabled)throw Error('Coding control unavailable');
  el.scrollIntoView({block:'center',inline:'center'});
  if(typeof el.click==='function')el.click();
 }

 function testResultStatus(onlyTab){
  const panel=testcasePanel();
  const panelText=text(panel);
  
  if(/Traceback|SyntaxError|NameError|TypeError|IndexError|ValueError|KeyError|Compilation Error|Runtime Error|Time Limit/i.test(panelText)){
   return {pass:false,done:true};
  }

  const tabs=onlyTab?[onlyTab]:cases();
  if(tabs.length){
   let hasFail=false,passedTabs=0;
   for(const tab of tabs){
    let hasPass=false;
    const tabCls=(tab.className+' '+(tab.getAttribute('aria-label')||'')).toLowerCase();
    if(/fail|error|wrong|invalid/.test(tabCls))hasFail=true;
    if(/pass|success|check/.test(tabCls))hasPass=true;

    const icons=tab.querySelectorAll('svg, img, i, span, path, circle, use');
    for(const icon of icons){
     const cls=((icon.getAttribute('class')||'')+' '+(icon.getAttribute('aria-label')||'')+' '+(icon.getAttribute('data-icon')||'')).toLowerCase();
     if(/error|fail|close|cross|cancel|times|wrong|red/.test(cls))hasFail=true;
     if(/success|check|pass|green/.test(cls))hasPass=true;

     const s=getComputedStyle(icon);
     const path=icon.querySelector('path');
     const ps=path?getComputedStyle(path):null;
     const col=`${s.fill} ${s.stroke} ${s.color} ${ps?.fill||''} ${ps?.stroke||''}`;
     for(const m of col.matchAll(/rgba?\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)/g)){
      const r=+m[1],g=+m[2],b=+m[3];
      if(r>100&&r>g*1.3&&r>b*1.1)hasFail=true;
      if(g>85&&g>r*1.25&&g>b*1.08)hasPass=true;
     }
    }
    if(hasPass)passedTabs++;
   }
   if(hasFail)return {pass:false,done:true};
   if(passedTabs===tabs.length)return {pass:true,done:true};
   return {pass:false,done:false};
  }

  if(/Wrong Answer|Failed/i.test(panelText)){
   return {pass:false,done:true};
  }
  if(/All Testcases Passed/i.test(panelText)){
   return {pass:true,done:true};
  }

  return {pass:false,done:false};
 }

 function extractTestFeedback(){
  const panel=testcasePanel();
  let feedback='';
  const pText=(panel?.innerText||'').trim();

  if(pText){
   const tbMatch=pText.match(/(?:Traceback|SyntaxError|NameError|TypeError|IndexError|ValueError|KeyError|Errors?\/Warnings?)[\s\S]*?(?=\n\n|\n[A-Z][a-z]+:|$)/i);
   if(tbMatch){
    feedback+='Error Details:\n'+tbMatch[0].trim().slice(0,800)+'\n\n';
   }

   const lines=pText.split('\n').map(l=>l.trim()).filter(Boolean);
   let currentSection='';
   const sections={};
   for(const line of lines){
    if(/^Input/i.test(line)){currentSection='Input';sections[currentSection]=[];}
    else if(/^Expected(?: Output)?\s*:?(?:\s|$)/i.test(line)){currentSection='Expected Output';sections[currentSection]=[];}
    else if(/^Your Output/i.test(line)){currentSection='Your Output';sections[currentSection]=[];}
    else if(/^Errors?\/Warnings?/i.test(line)){currentSection='Errors';sections[currentSection]=[];}
    else if(currentSection&&sections[currentSection].length<10){
     sections[currentSection].push(line);
    }
   }

   for(const [sec,content] of Object.entries(sections)){
    if(content.length){
     feedback+=`${sec}:\n${content.join('\n')}\n\n`;
    }
   }

   if(!feedback.trim()){
    feedback=pText.slice(0,1500);
   }
  }

  const inputs=[...(panel?.querySelectorAll('textarea, input')||[])].map(e=>e.value).filter(Boolean);
  if(inputs.length&&!feedback.includes(inputs[0])){
   feedback+='\nTest IO:\n'+inputs.join('\n').slice(0,1000);
  }

  return feedback.trim()||'Test case output did not match expected output.';
 }

 function submittedResult(){
  const t=text(leftPanel());
  const m=t.match(/(\d+)\s*\/\s*(\d+)\s*Testcases?\s*Passed/i);
  if(!m)return null;
  const passed=+m[1],total=+m[2];
  if(!total||passed>total)return null;
  return {passed,total,feedback:extractTestFeedback()};
 }

 async function clickAndWait(id,getResult,token,url,minWait=1200,maxWait=60000){
  const button=document.getElementById(id)
    ||[...document.querySelectorAll('button')].find(b=>visible(b)&&(new RegExp(id,'i').test(b.id||'')||new RegExp('^\\s*(?:▶\\s*)?'+id.replace(/Code$/,''),'i').test(text(b))));
  if(!button||button.disabled)throw Error(id+' unavailable');
  
  const before=JSON.stringify(getResult());
  let pending=false;
  const observer=new MutationObserver(()=>{if(button.disabled||/running|evaluating|executing/i.test(text(button)))pending=true;});
  observer.observe(button,{attributes:true,childList:true,subtree:true});
  clickControl(button);
  const startTime=Date.now();
  try{
  while(Date.now()-startTime<maxWait){
   check(token,url);
   const isRunning=button.disabled||/running|evaluating|executing/i.test(button.className+' '+text(button))||!!button.querySelector('svg[class*="spin"], [class*="spinner"]');
   const res=getResult();
   const ready=res?.done||Number.isInteger(res?.total)&&res.total>0;
   if(isRunning||!ready)pending=true;
   if(Date.now()-startTime>=minWait&&!isRunning&&ready&&(pending||JSON.stringify(res)!==before))return res;
   await sleep(250);
  }
  throw Error('No fresh test result received. Stopped without re-submitting.');
  }finally{observer.disconnect();}
 }

 async function visibleTests(token,url){
  await clickAndWait('runCode',()=>testResultStatus(),token,url);
  await sleep(350);
  
  const tabs=cases();
  if(tabs.length>1){
   for(const tab of tabs){
    check(token,url);
    clickControl(tab);
    await sleep(200);
    const st=testResultStatus(tab);
    if(st.done&&!st.pass){
     return {pass:false,feedback:`Failed on ${text(tab)}:\n`+extractTestFeedback()};
    }
   }
  }
  
  const finalStatus=testResultStatus();
  return {pass:finalStatus.pass,feedback:extractTestFeedback()};
 }

 function ensurePython(){
  try{
   const selects=[...document.querySelectorAll('select')].filter(visible);
   for(const sel of selects){
    const pyOpt=[...sel.options].find(o=>/python/i.test(o.text||o.value));
    if(pyOpt){
     if(sel.value!==pyOpt.value){
      sel.value=pyOpt.value;
      sel.dispatchEvent(new Event('change',{bubbles:true}));
      sel.dispatchEvent(new Event('input',{bubbles:true}));
     }
     return true;
    }
   }
   const buttons=[...document.querySelectorAll('button,[role="button"]')].filter(visible);
   if(buttons.some(b=>/^\s*python(?:\s*\d.*)?\s*$/i.test(text(b))))return true;
   const otherLangBtn=buttons.find(b=>/^\s*(?:java|c\+\+|c|javascript)\s*$/i.test(text(b)));
   if(otherLangBtn){
    otherLangBtn.click();
    setTimeout(()=>{
     const pyItem=[...document.querySelectorAll('li,div,span,a,button')].find(e=>visible(e)&&/^\s*python(?:\s*3.*)?\s*$/i.test(text(e)));
     if(pyItem)pyItem.click();
    },150);
   }
  }catch{}
  return true;
 }

 async function start(){
  if(running)return;
  running=true;submitted=false;
  const token=++epoch,url=location.href;
  try{
   const settings=await Helper.settings();
   const limit=Math.min(5,Math.max(1,settings.codingAttempts||3));
   
   // Wait up to 10s for the coding editor and problem panel to mount in React
   const mountDeadline=Date.now()+10000;
   while(Date.now()<mountDeadline){
    check(token,url);
    const hasEd=!!(document.getElementById('codingQuestionEditor')||document.querySelector('.ace_editor, .monaco-editor')||globalThis.ccbpWeb?.detected?.());
    const hasDesc=!!(document.getElementById('DESCRIPTION')||document.getElementById('runCode')||document.getElementById('submitCode'));
    if(hasEd&&hasDesc)break;
    await sleep(100);
   }

   document.getElementById('DESCRIPTION')?.click();
   await sleep(350);
   check(token,url);
   
   const panel=leftPanel(),problem=text(panel);
   if(globalThis.ccbpWeb?.detected()){
    const result=await ccbpWeb.start({request,check:()=>check(token,url),sleep,url,problem,panel,limit,setStatus:s=>status=s,submit:get=>clickAndWait('submitCode',get,token,url,1200)});
    submitted=!!result.done;return result;
   }
   if(!/Input|Output/i.test(problem))throw Error('Problem description unavailable');
   ensurePython();
   await sleep(150);
   const original=await request({type:'coding-editor',action:'read',url});
   check(token,url);
   if(original.language&&/^(?:java|cpp|c|csharp|golang|ruby|rust)$/i.test(original.language)){
    throw Error('Select Python before starting coding practice');
   }
   sessionStorage.setItem('ccbp-helper-backup:'+url,original.code);
   let current=original.code,feedback='',previous='';
   
   for(let attempt=1;attempt<=limit;attempt++){
    check(token,url);
    status=`Coding: generating solution (attempt ${attempt}/${limit})…`;
    
    const result=await request({
     type:'coding-generate',
     input:{problem,starterCode:original.code,currentCode:current,feedback}
    });
    check(token,url);
    
    if(result.code===previous&&attempt>1){
     feedback+='\nThe last proposed code was identical to the failed code. Reconsider the algorithm and edge cases.';
     continue;
    }
    previous=result.code;
    
    await request({type:'coding-editor',action:'write',url,code:result.code,expectedCode:current});
    await sleep(400);
    check(token,url);
    const verified=await request({type:'coding-editor',action:'read',url});
    current=verified?.code||result.code;
    
    status=`Coding: running tests (attempt ${attempt}/${limit})…`;
    const tested=await visibleTests(token,url);
    check(token,url);
    
    if(!tested.pass){
     feedback=tested.feedback;
     status='Visible test failed. Preparing the next attempt…';
     globalThis.ccbpLog?.('Attempt '+attempt+' failed: '+feedback.slice(0,1200));
     continue;
    }
    
    status='Visible tests passed. Submitting code…';
    const submission=await clickAndWait('submitCode',()=>submittedResult(),token,url,1800);
    check(token,url);
    
    if(submission&&Number.isInteger(submission.total)&&submission.total>0&&submission.passed===submission.total){
     submitted=true;status=`Coding complete: ${submission.passed}/${submission.total} submission tests passed.`;
     return {done:true};
    }
    
    feedback=`Latest submission: ${submission?.passed||0}/${submission?.total||0} passed.\n`+(submission?.feedback||extractTestFeedback());
   }
   
   status='Coding attempt limit reached. Skipping this problem.';
   return {exhausted:true};
  }catch(e){
   status=e.message;
   return /^Image/i.test(e.message)?{skipped:true,reason:e.message}:{error:e.message};
  }finally{
   if(token===epoch)running=false;
  }
 }

 globalThis.ccbpCoding={
  detected:()=>{
   if(document.getElementById('runCode')||document.getElementById('submitCode'))return true;
   const buttons=[...document.querySelectorAll('button,[role=button]')].filter(visible);
   if(buttons.some(b=>/run\s*code|submit\s*code/i.test(text(b))))return true;
   if(document.getElementById('codingQuestionEditor')&&buttons.some(b=>/run|submit|test/i.test(text(b))))return true;
   if(globalThis.ccbpWeb?.detected?.())return true;
   if(/\/(?:question|default-question)\//i.test(location.pathname))return true;
   return false;
  },
  start,
  save:async()=>{
   if(submitted)return true; // Accepted submission already persists the code on the portal.
   const e=[...document.querySelectorAll('button,[role=button],[title],[aria-label]')].find(e=>visible(e)&&/^save(?: code)?$/i.test(e.getAttribute('title')||e.getAttribute('aria-label')||text(e)));
   if(!e)return false;e.click();await sleep(600);return true;
  },
  stop:()=>{epoch++;running=false;status='Stopped. Any already-started server run may finish.';},
  status:()=>status,
  running:()=>running
 };
})();
