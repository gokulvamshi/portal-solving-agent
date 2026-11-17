const $=id=>document.getElementById(id);let savedLog=[];
async function tabs(){
 const all=await chrome.tabs.query({url:'https://learning.ccbp.in/*'}),selected=$('target').value||new URL(location.href).searchParams.get('tab');
 $('target').replaceChildren(...all.map(t=>{
  const o=document.createElement('option');
  o.value=t.id;
  o.textContent=t.title+' — '+new URL(t.url).pathname;
  o.selected=String(t.id)===selected;
  return o;
 }));
}
async function load(){
 const s=await Helper.settings();
 for(const k of Object.keys(Helper.defaults)){
  $(k).type==='checkbox'?$(k).checked=s[k]:$(k).value=s[k];
 }
}
async function save(){
 const s={singleModelMigration:1,speedMigration:7};
 for(const k of Object.keys(Helper.defaults)){
  const e=$(k);
  s[k]=e.type==='checkbox'?e.checked:typeof Helper.defaults[k]==='number'?Number(e.value):e.value.trim();
 }
 if(!s.mcqModel||!s.codingModel)throw Error('Enter both model names');
 if(['course','subject'].includes(s.scope)&&!s.includeMCQ&&!s.includeCoding)throw Error('Select at least one practice type');
 if(s.scope==='subject'&&!s.subject)throw Error('Choose a subject');
 s.semester=Math.min(12,Math.max(1,Math.floor(s.semester)||1));
 s.codingAttempts=Math.min(5,Math.max(1,s.codingAttempts));
 s.delay=Math.min(5000,Math.max(250,s.delay));
 s.temperature=Math.min(1,Math.max(0,s.temperature));
 await chrome.storage.local.set({settings:s});
 $('saved').textContent='Saved.';
}
async function send(action){
 const id=Number($('target').value);
 if(!id)throw Error('Open the learning portal first');
 try{
  const r=await chrome.tabs.sendMessage(id,{action});
  if(r?.error)throw Error(r.error);
  $('status').textContent=r?.status||'Ready';
  return r;
 }catch(err){
  if(err.message&&err.message.includes('Receiving end does not exist')){
   try{
    await chrome.scripting.executeScript({
     target:{tabId:id},
     files:['shared.js','assets.js','web-coding.js','coding.js','content.js','navigation.js','subjects.js','controller.js']
    });
    await new Promise(r=>setTimeout(r,400));
    const r=await chrome.tabs.sendMessage(id,{action});
    if(r?.error)throw Error(r.error);
    $('status').textContent=r?.status||'Ready';
    return r;
   }catch{
    throw Error('Could not connect. Please click on the learning portal tab, press F5 (refresh), and try again.');
   }
  }
  throw err;
 }
}
const handle=fn=>async()=>{
 try{
  await fn();
 }catch(e){
  $('status').textContent=e.message;
 }
};
$('save').onclick=handle(save);
$('refresh').onclick=handle(tabs);
$('scan').onclick=handle(async()=>{
 $('scanResult').textContent=JSON.stringify((await send('scan')).scan,null,2);
});
$('start').onclick=handle(async()=>{
 await save();
 const models=await chrome.runtime.sendMessage({type:'models'});
 if(models.error)throw Error(models.error);
 const scope=$('scope').value,needed=[];
 const kind=scope==='current'?(await send('scan')).scan.kind:null;
 if(kind==='mcq'||(['course','subject'].includes(scope)&&$('includeMCQ').checked))needed.push($('mcqModel').value.trim());
 if(kind==='coding'||scope==='coding-list'||(['course','subject'].includes(scope)&&$('includeCoding').checked))needed.push($('codingModel').value.trim());
 for(const name of new Set(needed)){if(!models.models.includes(name))throw Error('Model not installed: '+name+'. Choose an installed model.');}
 await send('start');
});
$('stop').onclick=handle(()=>send('stop'));
$('focus').onclick=handle(()=>chrome.tabs.update(Number($('target').value),{active:true}));
$('modelsButton').onclick=handle(async()=>{
 const r=await chrome.runtime.sendMessage({type:'models'});
 if(r.error)throw Error(r.error);
 $('models').replaceChildren(...r.models.map(name=>{
  const o=document.createElement('option');
  o.value=name;
  return o;
 }));
 $('saved').textContent='Installed: '+r.models.join(', ');
});
$('export').onclick=()=>{
 const url=URL.createObjectURL(new Blob([JSON.stringify(savedLog,null,2)],{type:'application/json'}));
 const a=document.createElement('a');
 a.href=url;
 a.download='practice-activity.json';
 a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
};
void Promise.all([tabs(),load()]).catch(e=>{$('status').textContent=e.message;});
let polling=false;
setInterval(async()=>{
 if(polling||!$('target').value)return;
 polling=true;
 try{
  const r=await chrome.tabs.sendMessage(Number($('target').value),{action:'status'});
  $('status').textContent=r.status;
  $('progress').textContent=`${r.finished||0} practices/problems processed · ${r.skipped||0} items skipped`;
  $('start').disabled=!!r.active;
  $('save').disabled=!!r.active;
  $('target').disabled=!!r.active;
  for(const k of Object.keys(Helper.defaults))$(k).disabled=!!r.active;
  savedLog=r.log||[];
  $('activity').textContent=savedLog.map(x=>`${x.time}  ${x.message}`).join('\n');
 }catch{}finally{
  polling=false;
 }
},1500);

$('imagePermission').onclick=handle(async()=>{
 const tabId=Number($('target').value);if(!tabId)throw Error('Select the portal tab first');
 const result=await chrome.scripting.executeScript({target:{tabId},func:()=>[...document.images].map(i=>i.currentSrc||i.src).filter(Boolean)});
 const origins=[...new Set((result[0]?.result||[]).filter(u=>u.startsWith('https://')).map(u=>new URL(u).origin+'/*'))];
 if(!origins.length){$('saved').textContent='No external images on this page.';return;}
 const ok=await chrome.permissions.request({origins});$('saved').textContent=ok?'Practice image access enabled.':'Image access was not granted.';
});
