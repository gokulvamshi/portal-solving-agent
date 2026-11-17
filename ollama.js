// Fast, cancellable inference with Ollama
globalThis.ollamaChat=async function(body,signal,timeout=45000){
 const shouldThink=!!body.think;
 body={...body,think:shouldThink};
 
 if(shouldThink){
  if(body.format && typeof body.format === 'object'){
   delete body.format;
  }
 }else if(!body.format){
  body.format='json';
 }

 const heartbeat=setInterval(()=>{void chrome.runtime.getPlatformInfo().catch(()=>{});},20000);
 try{
  const response=await fetch('http://localhost:11434/api/chat',{
   method:'POST',headers:{'Content-Type':'application/json'},
   signal:AbortSignal.any([signal,AbortSignal.timeout(timeout)]),
   body:JSON.stringify({...body,stream:false})
  });
  if(!response.ok)throw Error(response.status===403?'Ollama blocked this extension. Add chrome-extension://'+chrome.runtime.id+' to OLLAMA_ORIGINS, then quit and restart Ollama.':'Ollama HTTP '+response.status+': '+(await response.text()).slice(0,240));
  
  const data=await response.json();
  if(data.error)throw Error(data.error);

  let content=data.message?.content||'';

  // Strip reasoning blocks (<think>...</think>) if returned inline in content
  content=content.replace(/<think>[\s\S]*?<\/think>/gi,'').trim();
  // Strip outer markdown code fences (```json ... ``` or ``` ... ```)
  content=content.replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i,'$1').trim();
  // Extract JSON object if there's surrounding text
  const firstBrace=content.indexOf('{');
  const lastBrace=content.lastIndexOf('}');
  if(firstBrace!==-1&&lastBrace>firstBrace){
   content=content.slice(firstBrace,lastBrace+1);
  }

  if(!content.trim()){
   if(data.done_reason==='length')throw Error('Model response reached length limit before generating an answer.');
   throw Error('Model finished without a final answer. No answer submitted.');
  }

  return {...data,message:{content}};
 }catch(e){
  if(signal.aborted)throw Error('Stopped');
  if(e.name==='TimeoutError')throw Error('Ollama took too long ('+Math.round(timeout/1000)+'s). Make sure Ollama is running.');
  throw e;
 }finally{clearInterval(heartbeat);}
};
