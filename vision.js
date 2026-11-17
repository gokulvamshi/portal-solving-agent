const visionCapabilities=new Map();
globalThis.requireVision=async(model,signal)=>{
 if(!model?.trim())throw Error('Image question needs an image-capable model. Set Image-capable model in settings.');
 if(visionCapabilities.has(model))return;
 const r=await fetch('http://localhost:11434/api/show',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model}),signal});
 if(!r.ok)throw Error('Image model could not be loaded: '+model);
 const info=await r.json();if(!info.capabilities?.includes('vision'))throw Error('Image model '+model+' does not support images. Choose a vision model.');
 visionCapabilities.set(model,true);
};
chrome.runtime.onMessage.addListener((q,sender,reply)=>{
 if(q.type!=='practice-image')return;
 if(!sender.tab?.url?.startsWith('https://learning.ccbp.in/'))return;
 (async()=>{try{
  const u=new URL(q.url);if(u.protocol!=='https:')throw Error('Image URL must use HTTPS');
  if(!await chrome.permissions.contains({origins:[u.origin+'/*']}))throw Error('Image access needed. Click Allow images on this practice page in the dashboard.');
  const r=await fetch(u.href,{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!r.ok||!/^image\/(png|jpeg|webp|gif)/i.test(r.headers.get('content-type')||''))throw Error('Image could not be loaded as a supported picture');
  const bytes=new Uint8Array(await r.arrayBuffer());if(bytes.length>8000000)throw Error('Image is larger than 8 MB');
  let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  reply({data:btoa(binary)});
 }catch(e){reply({error:e.message});}})();return true;
});
