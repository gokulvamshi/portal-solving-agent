(()=>{
 const visible=e=>e&&e.getClientRects().length>0;
 const text=e=>(e?.innerText||'').trim();
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 let running=false,epoch=0,status='Ready for coding practice.';
 async function request(msg){const r=await chrome.runtime.sendMessage(msg);if(r?.error)throw Error(r.error);if(!r)throw Error('No extension response');return r;}
 function check(token,url){if(token!==epoch)throw Error('Stopped');if(location.href!==url)throw Error('Question changed. Press Start on the new question.');}
 function leftPanel(){let el=document.getElementById('DESCRIPTION');for(;el&&el!==document.body;el=el.parentElement){if(el.querySelector('#SUBMISSION')&&/Helpful|Give Feedback/.test(text(el))&&!el.querySelector('#codingQuestionEditor'))return el;}throw Error('Cannot isolate problem/submission panel');}
 function cases(){return [...document.querySelectorAll('[id]')].filter(e=>visible(e)&&/^Case\s+\d+$/.test(text(e))&&!e.querySelector('[id]'));}
 function testPanel(){const tabs=cases();if(!tabs.length)throw Error('Visible test cases not found');let el=tabs[0];for(;el&&el!==document.body;el=el.parentElement){if(/\bInput\b/.test(text(el))&&!el.querySelector('#codingQuestionEditor')&&text(el).includes('Case'))return el;}throw Error('Cannot isolate test results');}
 function values(panel){return text(panel)+'\n'+[...panel.querySelectorAll('textarea,input')].map(e=>e.value).join('\n');}
 function submittedResult(panel){const t=text(panel);const m=t.match(/(\d+)\s*\/\s*(\d+)\s*Testcases Passed/i);if(!m)return null;const passed=+m[1],total=+m[2];if(!total||passed>total)return null;return {passed,total,feedback:values(panel).slice(0,12000)};}
 async function clickAndWait(id,panel,getResult,token,url){
  const button=document.getElementById(id);if(!button||button.disabled)throw Error(id+' unavailable');
  let changed=false,disabled=false;const before=values(panel);
  const observer=new MutationObserver(()=>{changed=true;});observer.observe(panel,{subtree:true,childList:true,characterData:true});
  try{button.click();for(let n=0;n<360;n++){check(token,url);await sleep(250);disabled ||= button.disabled;const result=getResult();
   // Require a fresh result transition, not a previous Solved label.
   if(n>=3&&!button.disabled&&(disabled||changed&&values(panel)!==before)&&result)return result;
  }throw Error('No fresh '+id+' result detected. Stopped without another submission.');}finally{observer.disconnect();}
 }
 async function visibleTests(token,url){
  const panel=testPanel();
  await clickAndWait('runCode',panel,()=>/Compiled Successfully|Wrong Answer|Error|Time Limit/i.test(text(panel)),token,url);
  const tabs=cases();if(!tabs.length)throw Error('No test case tabs');
  const feedback=[];for(const tab of tabs){check(token,url);tab.click();await sleep(250);const p=testPanel(),t=values(p);feedback.push(t);if(!/Compiled Successfully/i.test(t)||/Wrong Answer|Runtime Error|Compilation Error|Time Limit/i.test(t))return {pass:false,feedback:feedback.join('\n').slice(0,12000)};}
  return {pass:true,feedback:feedback.join('\n').slice(0,12000)};
 }
 async function start(){if(running)return;running=true;const token=++epoch,url=location.href;
  try{
   const settings=await Helper.settings();const limit=settings.codingAttempts;
   document.getElementById('DESCRIPTION')?.click();await sleep(200);check(token,url);
   const problem=text(leftPanel());if(!/Input|Output/.test(problem))throw Error('Problem description not available');
   const original=await request({type:'coding-editor',action:'read',url});check(token,url);
   if(!/python/i.test(original.language))throw Error('Coding mode currently supports Python only. Choose Python, then Start.');
   // Preserve a local recovery copy before any writes.
   sessionStorage.setItem('ccbp-helper-backup:'+url,original.code);
   let current=original.code,feedback='',previous='';
   for(let attempt=1;attempt<=limit;attempt++){
    check(token,url);status=`Coding practice: generating general solution (attempt ${attempt}/${limit})…`;
    const result=await request({type:'coding-generate',input:{problem,starterCode:original.code,currentCode:current,feedback}});check(token,url);
    if(result.code===previous)throw Error('Model repeated an unsuccessful solution. Stopped after no progress.');
    previous=result.code;
    await request({type:'coding-editor',action:'write',url,code:result.code,expectedCode:current});check(token,url);current=result.code;
    status=`Coding practice: running visible tests (attempt ${attempt}/${limit})…`;
    const tested=await visibleTests(token,url);check(token,url);
    if(!tested.pass){feedback='Visible test failure:\n'+tested.feedback;continue;}
    status='Visible tests passed. Submitting to check hidden tests…';
    const panel=leftPanel();const submission=await clickAndWait('submitCode',panel,()=>submittedResult(leftPanel()),token,url);check(token,url);
    if(submission.passed===submission.total){status=`Coding complete: ${submission.passed}/${submission.total} submission tests passed.`;return {done:true};}
    feedback=`Latest submission: ${submission.passed}/${submission.total} passed.\n`+submission.feedback;
   }
   status='Coding attempt limit reached. Skipping this problem.';return {exhausted:true};
  }catch(e){status=e.message;return {error:e.message};}finally{if(token===epoch)running=false;}
 }
 globalThis.ccbpCoding={detected:()=>!!document.getElementById('codingQuestionEditor')&&!!document.getElementById('submitCode'),start,stop:()=>{epoch++;running=false;status='Stopped. Any already-started server run may finish.';},status:()=>status,running:()=>running};
})();
