globalThis.Helper=(()=>{
 const defaults={
  mcqModel:'qwen3.5:9b',
  visionModel:'qwen3.5:9b',
  codingModel:'qwen3.5:9b',
  votes:1,
  tie:'stop',
  thinking:false,
  temperature:0.4,
  delay:100,
  codingAttempts:5,
  scope:'current',
  subject:'Computer Programming',
  semester:1,
  includeMCQ:true,
  includeCoding:true
 };
 const canonical=a=>Array.isArray(a)?JSON.stringify([...a].sort((x,y)=>x-y)):String(a).replace(/\r\n/g,'\n');
 function majority(votes){
  const c=new Map();
  for(const a of votes){
   const k=canonical(a),v=c.get(k)||{answer:a,count:0};
   v.count++;
   c.set(k,v);
  }
  return [...c.values()].find(v=>v.count>votes.length/2)?.answer??null;
 }
 function validateAnswer(d,q){
  if(q.kind==='text'){
   if(typeof d.answer!=='string'||d.answer.length>4000)throw Error('Invalid text answer');
   return d.answer.replace(/\r\n/g,'\n');
  }
  const a=d.answers;
  if(!Array.isArray(a)||!a.length||(!q.multiple&&a.length!==1)||new Set(a).size!==a.length||a.some(i=>!Number.isInteger(i)||i<0||i>=q.options.length))throw Error('Invalid option answer');
  return a;
 }
 async function settings(){
  const {settings={}}=await chrome.storage.local.get('settings');
  if(settings.speedMigration!==7){
   // v7: turbo speed — keep_alive 60m, stream:false, 50ms polling, 100ms delay
   Object.assign(settings,{
    mcqModel:'qwen3.5:9b',
    codingModel:'qwen3.5:9b',
    visionModel:'qwen3.5:9b',
    votes:1,
    thinking:false,
    delay:100,
    singleModelMigration:1,
    speedMigration:7
   });
   await chrome.storage.local.set({settings});
  }
  return {...defaults,...settings};
 }
 return {defaults,canonical,majority,validateAnswer,settings};
})();
