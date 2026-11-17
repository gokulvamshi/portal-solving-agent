(()=>{
 if(globalThis.ccbpAssets)return;
 const images=root=>[...root.querySelectorAll('img')].filter(i=>i.getClientRects().length&&(i.naturalWidth>40||i.naturalHeight>30||i.getBoundingClientRect().width>40||i.getBoundingClientRect().height>30));
 async function encode(img){
  if(!img.complete)await Promise.race([new Promise((r,j)=>{img.addEventListener('load',r,{once:true});img.addEventListener('error',j,{once:true});}),new Promise((_,j)=>setTimeout(()=>j(Error('Image did not load')),10000))]);
  if(!img.naturalWidth||!img.naturalHeight)throw Error('Image did not load');
  try{const c=document.createElement('canvas'),scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/png').split(',')[1];}catch{}
  const r=await chrome.runtime.sendMessage({type:'practice-image',url:img.currentSrc||img.src});
  if(r?.error)throw Error(r.error);if(!r?.data)throw Error('Image could not be read');return r.data;
 }
 async function collect(entries){
  if(entries.length>12)throw Error('Image count exceeds 12; review this question manually.');
  const result=[];for(const e of entries)result.push({label:e.label,data:await encode(e.image)});return result;
 }
 globalThis.ccbpAssets={images,collect};
})();
