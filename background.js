importScripts('python-background.js','vision.js','ollama.js','shared.js','coding-background.js','code-reader.js');
const jobs=new Map();
chrome.action.onClicked.addListener(async tab=>{await chrome.tabs.create({url:chrome.runtime.getURL('dashboard.html')+'?tab='+tab.id});});
chrome.runtime.onMessage.addListener((q,sender,reply)=>{
 if(['run-save','run-load'].includes(q.type)){
  if(!sender.tab?.id||!sender.tab.url?.startsWith('https://learning.ccbp.in/'))return;
  const key='run-tab-'+sender.tab.id;
  (async()=>{try{
   if(q.type==='run-save'){await chrome.storage.local.set({[key]:q.state});reply({ok:true});}
   else reply({state:(await chrome.storage.local.get(key))[key]||null});
  }catch(e){reply({error:e.message});}})();return true;
 }
 if(q.type==='cancel-model'){jobs.get(sender.tab?.id)?.abort();globalThis.codingJobs?.get(sender.tab?.id)?.abort();reply({ok:true});return;}
 if(q.type==='models'&&sender.url?.startsWith(chrome.runtime.getURL(''))){fetch('http://localhost:11434/api/tags',{signal:AbortSignal.timeout(10000)}).then(r=>{if(!r.ok)throw Error(r.status===403?'Ollama blocked this extension. Allow chrome-extension://'+chrome.runtime.id+' in OLLAMA_ORIGINS and restart Ollama.':'Ollama HTTP '+r.status);return r.json();}).then(d=>reply({models:d.models.map(m=>m.name)})).catch(e=>reply({error:e.message}));return true;}
 if(q.type!=='solve')return;if(!sender.tab?.url?.startsWith('https://learning.ccbp.in/')){reply({error:'Unsupported page'});return;}
 (async()=>{const controller=new AbortController();jobs.set(sender.tab.id,controller);try{
 const s=await Helper.settings();
 if(typeof q.question!=='string'||q.question.length>24000||(q.code||'').length>24000)throw Error('Invalid or oversized question');
 if(q.kind!=='text'&&(!Array.isArray(q.options)||q.options.length<2||q.options.length>12))throw Error('Invalid options');

 const images=q.images||[];
 if(!Array.isArray(images)||images.length>12||images.some(x=>typeof x.data!=='string'||x.data.length>12000000||typeof x.label!=='string'||x.label.length>100))throw Error('Invalid image context');
 if(images.some(x=>!/^Option \d+ image$/.test(x.label)))throw Error('Only MCQ option images are enabled. Refresh the portal to load the latest helper.');
 const model=images.length?s.visionModel:s.mcqModel;
 if(images.length)await requireVision(model,controller.signal);

 let executed=null;
 // Only run local Python executor for Python output questions.
 const isPythonOutput=!images.length&&q.code?.trim()&&/python/i.test(q.question)&&/output|print/i.test(q.question)&&!/not|incorrect|which.*(?:statement|line)/i.test(q.question);
 if(isPythonOutput){
  executed=await pythonOutput(q.code);
  if(controller.signal.aborted)throw Error('Stopped');
  const exact=exactPythonAnswer(q,executed);
  if(exact!==null){reply({answers:exact,votes:[exact],traces:['Calculated with local Python 3.10: '+JSON.stringify(executed)]});return;}
 }

 // ── Classify the code context ──────────────────────────────────────────────
 // hasCode = there is a code snippet alongside the question (CSS, Python, JS…)
 // isPython = it's specifically Python code that benefits from tracing
 const hasCode=!!q.code?.trim();
 const isPython=hasCode&&/python|def |print\(|import /i.test(q.code);

 // ── JSON schema ────────────────────────────────────────────────────────────
 // NEVER put trace in required[] — it forces the model to generate 100-300 extra
 // tokens of reasoning text BEFORE the answer, blowing the token budget every time.
 // Keep trace as an optional property only for Python where it aids accuracy.
 const answerProp=q.kind==='text'
  ?{answer:{type:'string'}}
  :{answers:{type:'array',items:{type:'integer',enum:q.options.map((_,i)=>i)},minItems:1,maxItems:q.multiple?q.options.length:1,uniqueItems:true}};
 const properties={
  ...answerProp,
  ...(isPython?{trace:{type:'string'}}:{})  // optional, not in required[]
 };
 const required=Object.keys(answerProp); // only the answer field is required

 // ── Prompt ─────────────────────────────────────────────────────────────────
 let userContent='';
 if(hasCode){
  // Label the language so the model knows not to "run" CSS/HTML as Python.
  const lang=isPython?'python':'code';
  userContent+=`${lang.charAt(0).toUpperCase()+lang.slice(1)}:\n\`\`\`${lang}\n${q.code.trim()}\n\`\`\`\n\n`;
 }
 userContent+=`Question:\n${q.question}\n\n`;
 if(q.kind==='text'){
  userContent+='Return only the exact expected output value.';
 }else{
  userContent+='Options:\n'+q.options.map((opt,idx)=>`[${idx}] ${JSON.stringify(opt)}`).join('\n')+'\n\nReturn the correct index/indices in the answers array.';
 }
 // Targeted hint per code type — keep it ONE short sentence.
 if(isPython)userContent+='\nTrace Python statements in order; note exact output including spaces and punctuation.';
 else if(hasCode)userContent+='\nAnalyze the code and pick the correct option.';
 if(executed?.supported)userContent+='\nVerified Python output: '+JSON.stringify(executed)+' — use this exactly.';
 if(images.length)userContent+='\nImages: '+images.map((x,i)=>i+': '+x.label).join('; ')+'. Match each to its option index.';

 // ── System prompt (concise) ────────────────────────────────────────────────
 const systemPrompt=q.kind==='text'
  ?'You are an assessment solver. Return JSON with the exact output in "answer". No explanations.'
  :'You are an assessment solver. Select '+(q.multiple?'ALL correct options':'exactly ONE correct option')+'. Return JSON with zero-based option index in "answers". No explanations.';

 // ── Speed settings ─────────────────────────────────────────────────────────
 // num_ctx: allocate only what's needed. Bigger = slower KV cache allocation.
 //   no-code MCQ  → 2048  (question + options easily fit)
 //   code MCQ     → 4096  (code snippet + question + options)
 const num_ctx=2048;

 // num_predict: JSON answer is 20-80 tokens. No mandatory trace = no budget blowout.
 //   instruct no-code : 150   ({"answers":[2]} style)
 //   instruct + code  : 250   (slightly more room for code-aware answer)
 //   thinking no-code : 600   (<think>…</think> + answer)
 //   thinking + code  : 1000  (<think>…</think> with trace + answer)
 const numPredict=s.thinking
  ?(hasCode?2048:1024)
  :(hasCode?200:100);

 const voteCount=s.votes===1?1:3;
 const timeoutMs=s.thinking?90000:45000;

 const votes=[],traces=[];
 for(let i=0;i<voteCount;i++){
  if(controller.signal.aborted)throw Error('Stopped');
  const d=await ollamaChat({
   model,
   think:!!s.thinking,
   keep_alive:'60m',
   messages:[
    {role:'system',content:systemPrompt+' '+[
     'Answer directly from the given facts.',
     'Verify by substituting candidate answers back into the question.',
     'Independently audit each option then confirm your answer.'
    ][i]},
    {role:'user',content:userContent,...(images.length?{images:images.map(x=>x.data)}:{})}
   ],
   format:{type:'object',properties,required,additionalProperties:false},
   options:{
    num_ctx,
    num_predict:numPredict,
    temperature:voteCount===1?0:Math.min(0.3,Math.max(0,Number(s.temperature)||0)),
    seed:1009+i*37
   }
  },controller.signal,timeoutMs);
    let parsed;
  try{
   parsed=JSON.parse(d.message.content);
  }catch{
   if(d.done_reason==='length')throw Error('Model response cut off before completing JSON answer.');
   throw Error('Model output could not be parsed as JSON: '+(d.message?.content||'').slice(0,120));
  }
  votes.push(Helper.validateAnswer(parsed,q));
  traces.push(parsed.trace||'');
 }
 const answer=Helper.majority(votes);
 if(answer===null&&s.tie!=='first')throw Error('No majority: '+votes.map(Helper.canonical).join(' | ')+'. Paused before submitting.');
 reply({answers:answer??votes[0],votes,traces});
 }catch(e){reply({error:e.message});}finally{if(jobs.get(sender.tab.id)===controller)jobs.delete(sender.tab.id);}})();return true;
});
