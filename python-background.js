let creatingPythonHost;
globalThis.pythonOutput=async code=>{
 try{
  if(!await chrome.offscreen.hasDocument()){
   creatingPythonHost ||= chrome.offscreen.createDocument({url:'python-host.html',reasons:['WORKERS'],justification:'Calculate supported Python practice outputs in a bounded local worker'}).finally(()=>creatingPythonHost=null);
   await creatingPythonHost;
  }
  return await chrome.runtime.sendMessage({type:'python-worker-run',id:crypto.randomUUID(),code});
 }catch(e){return {supported:false,reason:e.message};}
};
globalThis.exactPythonAnswer=(q,result)=>{
 if(!result?.supported)return null;
 const output=result.output.replace(/\n$/,'');
 if(q.kind==='text')return result.exception?null:output;
 if(q.multiple)return null;
 const candidates=[];
 q.options.forEach((s,i)=>{
  if(result.exception){if(s.trim()===result.exception)candidates.push(i);}
  else if(s.replace(/\r\n/g,'\n')===output)candidates.push(i);
 });
 return candidates.length===1?[candidates[0]]:null;
};
