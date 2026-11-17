chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
 if(msg.type!=='mcq-code')return;
 (async()=>{try{
  if(!sender.tab?.url?.startsWith('https://learning.ccbp.in/'))throw Error('Unsupported page');
  const r=await chrome.scripting.executeScript({
    target:{tabId:sender.tab.id},
    world:'MAIN',
    func:(url)=>{
      if(location.href!==url)throw Error('Page changed');
      const results=[];
      // 1. Ace editor instances
      const roots=[...document.querySelectorAll('.ace_editor')].filter(e=>e.getClientRects().length&&!/input|output/i.test(e.id));
      for(const root of roots){
        try{
          if(root.env?.editor?.getValue){
            const v=root.env.editor.getValue();
            if(v)results.push(v);
          }else if(window.ace?.edit){
            const v=window.ace.edit(root)?.getValue?.();
            if(v)results.push(v);
          }
        }catch{}
        if(!results.length)throw Error('Full code is unavailable; the visible lines may be incomplete');
      }
      // 2. Monaco editor models
      try{
        const models=window.monaco?.editor?.getModels?.()||[];
        for(const m of (document.querySelector('.monaco-editor')&&models.length===1?models:[])){
          const v=m.getValue?.();
          if(v)results.push(v);
        }
      }catch{}
      // 3. Code / pre blocks
      if(!results.length){
        const blocks=[...document.querySelectorAll('pre code, pre')].filter(e=>e.getClientRects().length);
        results.push(...blocks.filter(e=>!e.parentElement.closest('pre')).map(e=>e.innerText||e.textContent||''));
      }
      return {code:results.filter(Boolean).join('\n\n')};
    },
    args:[msg.url]
  });
  reply(r[0]?.result||{code:''});
 }catch(e){reply({code:'',error:e.message});}})();
 return true;
});
