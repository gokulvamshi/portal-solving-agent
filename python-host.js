let queue=Promise.resolve();
chrome.runtime.onMessage.addListener((q,sender,reply)=>{
 if(q.type!=='python-worker-run'||sender.id!==chrome.runtime.id||sender.tab)return;
 queue=queue.then(()=>new Promise(resolve=>{
  const worker=new Worker('python-worker.js');
  let timer;const finish=r=>{clearTimeout(timer);worker.terminate();reply(r);resolve();};
  timer=setTimeout(()=>finish({supported:false,reason:'Python runtime startup timed out'}),30000);
  worker.onerror=e=>finish({supported:false,reason:e.message});
  worker.onmessage=e=>{if(e.data.ready){clearTimeout(timer);timer=setTimeout(()=>finish({supported:false,reason:'Python execution timed out'}),2000);}else finish(e.data.result);};
  worker.postMessage({id:q.id,code:q.code});
 }));return true;
});
