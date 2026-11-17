(()=>{
 if(globalThis.ccbpSubjects)return;
 const text=e=>(e?.innerText||e?.textContent||'').replace(/\s+/g,' ').trim();
 const visible=e=>e&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
 const all=(root,s)=>[...root.querySelectorAll(s)].filter(visible);
 const leaf=(root,match)=>all(root,'button,a,div,span,p,h2,h3').filter(e=>match(text(e))&&!Array.from(e.children).some(c=>match(text(c))));
 const click=e=>{if(!e||e.disabled)throw Error('Curriculum control unavailable');e.scrollIntoView({block:'center'});(e.closest('button,a,[role="button"]')||e).click();};
 const pause=()=>new Promise(r=>setTimeout(r,800));
 function courseCards(subject){
  for(let p=subject,n=0;p&&n<6;n++,p=p.parentElement){
   const cards=leaf(p,s=>/^.+\s+Topics\s*:\s*\d+$/i.test(s)&&s.length<180);
   const others=leaf(p,s=>/^.+\s+Courses?\s*:\s*\d+$/i.test(s));
   if(others.length>1)return [];
   if(cards.length)return cards;
  }
  return [];
 }
 async function advance(run,guard,persist){
  guard();
  if(location.pathname!=='/curriculum'){
   run.subjectOpened=false;run.openedSemester=false;persist();
   location.assign('https://learning.ccbp.in/curriculum');return {navigating:true};
  }
  const dialog=all(document,'[role="dialog"]').at(-1);
  if(dialog){
   const practice=leaf(dialog,s=>/^(MCQ Practice|Coding Practice)$/.test(s))[0];
   if(practice){click(practice);await pause();guard();return;}
   const topics=all(dialog,'button,[role="button"]').filter(e=>/\d+\s*%/.test(text(e))&&text(e).length<180);
   const topic=topics.find(e=>!run.discoveryTopics.includes(text(e).replace(/\s*\d+\s*%/g,'')));
   if(!topic)throw Error('This course has no recognized practice entry. Open a practice list or select another subject.');
   run.discoveryTopics.push(text(topic).replace(/\s*\d+\s*%/g,''));persist();click(topic);await pause();guard();return;
  }
  const wanted=run.settings.subject.toLowerCase();
  const subject=leaf(document,s=>s.replace(/\s+Courses?\s*:\s*\d+$/i,'').toLowerCase()===wanted)[0];
  if(!subject){
   const semester=all(document,'button,[role="button"]').find(e=>new RegExp('^Semester\\s*'+run.settings.semester+'\\b','i').test(text(e)));
   if(semester&&!run.openedSemester){run.openedSemester=true;persist();click(semester);await pause();return;}
   throw Error('Subject not found in Semester '+run.settings.semester+': '+run.settings.subject);
  }
  const cards=courseCards(subject);
  if(!cards.length&&!run.subjectOpened){run.subjectOpened=true;persist();click(subject);await pause();return;}
  if(!cards.length)throw Error('The selected subject did not expose its course cards.');
  const name=e=>text(e).replace(/\s*Topics\s*:\s*\d+$/i,'');
  const tile=cards.find(e=>!run.visitedCourses.includes(name(e)));
  if(!tile)return {done:true};
  run.currentCourseName=name(tile);run.discoveryTopics=[];persist();click(tile);await pause();guard();
 }
 globalThis.ccbpSubjects={advance,courseCards};
})();
