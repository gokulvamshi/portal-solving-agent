(()=>{
 if(globalThis.ccbpNav)return;
 const text=e=>(e?.innerText||e?.textContent||'').replace(/\s+/g,' ').trim();
 const visible=e=>!!e&&e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden';
 const all=(s,root=document)=>[...root.querySelectorAll(s)].filter(visible);
 const exact=(s,root=document)=>all('button,a,p,span,div,h1,h2,h3,h4',root).filter(e=>text(e)===s&&!Array.from(e.children).some(c=>text(c)===s));
 
 // Sidebar is in the left half of the screen
 const left=e=>{
  const r=e.getBoundingClientRect();
  return r.left<innerWidth*0.48&&r.right<=innerWidth*0.52&&r.width>20&&r.height>0;
 };
 const course=()=>location.pathname==='/course';
 const courseId=url=>new URL(url).searchParams.get('c_id');

 function isCoding(name){
  return /Coding/i.test(name||'');
 }
 function isMCQ(name){
  return !isCoding(name);
 }

 function isPracticeTitle(s){
  if(!s||typeof s!=='string')return false;
  s=s.replace(/[>→»]/g,'').trim();
  if(s.length<3||s.length>95)return false;
  // NEVER include quizzes or classroom quizzes — user requested ONLY practices
  if(/Quiz|Class\s*Room|Reading Material|Cheat Sheet|Video|Lecture|Session|Notes|Overview|Instructions|Submissions|Curriculum|Feedback|Practice Attempts/i.test(s))return false;
  if(/^\d+\s*(?:mins?|hours?|sec)\b/i.test(s))return false;
  return /MCQ\s*Practice|Coding\s*Practice|Daily\s*Practice|\bPractice\b|MCQs/i.test(s);
 }

 function clickable(e){
  if(!e)return null;
  const control=e.closest('button,a,[role=button]');
  if(control&&typeof control.click==='function')return control;
  for(let p=e;p&&p!==document.body;p=p.parentElement){
   if(p.namespaceURI==='http://www.w3.org/1999/xhtml'&&typeof p.click==='function')return p;
  }
  return null;
 }

 function rowFor(e){
  let best=e;
  let p=e.parentElement;
  while(p&&p!==document.body){
   const r=p.getBoundingClientRect();
   if(!left(p)||r.height>140)break;
   if(r.height>=28&&r.width>=120){
    best=p;
    if(p.parentElement&&Array.from(p.parentElement.children).filter(c=>all('svg,img',c).length>0).length>1){
     break;
    }
   }
   p=p.parentElement;
  }
  return best;
 }

 function green(v){
  const m=v?.match(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/);
  return !!m&&+m[2]>85&&+m[2]>+m[1]*1.25&&+m[2]>+m[3]*1.08;
 }

 function complete(row){
  const label=[row,...all('[aria-label],[data-status],img',row)].map(e=>(e.getAttribute('aria-label')||'')+' '+(e.getAttribute('data-status')||'')+' '+(e.getAttribute('alt')||'')).join(' ');
  if(/incomplete|not completed|in.progress|not.started|not.attempted/i.test(label))return false;
  if(/completed|solved/i.test(label))return true;
  const icons=all('svg,img',row);
  if(!icons.length)return null;
  const end=icons.at(-1), rr=row.getBoundingClientRect(), ir=end.getBoundingClientRect();
  if(ir.left<rr.left+rr.width*.50)return null;
  if(/completed|success|check-green/i.test(end.getAttribute('src')||''))return true;
  const nodes=[end,...end.querySelectorAll('*')];
  if(nodes.some(e=>{const s=getComputedStyle(e);return green(s.fill)||green(s.stroke)||green(s.color)||green(s.backgroundColor);}))return true;
  if(end.tagName.toLowerCase()==='svg')return false;
  if(/incomplete|pending|unchecked|not-completed/i.test(end.getAttribute('src')||''))return false;
  return null;
 }

 function practices(moduleName){
  const counts={};
  const mods=modules();
  const modIdx=moduleName?mods.findIndex(m=>m.name===moduleName):-1;

  let topLimit=65;
  let bottomLimit=Infinity;

  if(modIdx!==-1){
   topLimit=mods[modIdx].bottom;
   bottomLimit=(modIdx+1<mods.length)?mods[modIdx+1].top:Infinity;
  }

  const candidates=all('h1,h2,h3,h4,h5,p,span,div,a,button',document).filter(e=>{
   if(!left(e))return false;
   const r=e.getBoundingClientRect();
   if(modIdx!==-1){
    const midY=r.top+r.height/2;
    if(midY<topLimit||midY>bottomLimit)return false;
   }
   const t=text(e);
   if(!isPracticeTitle(t))return false;
   return !Array.from(e.children).some(c=>visible(c)&&isPracticeTitle(text(c)));
  });

  return candidates.map(e=>({
   name:text(e),
   node:rowFor(e),
   target:clickable(e)||clickable(rowFor(e))||e
  })).filter((x,i,a)=>a.findIndex(y=>y.node===x.node)===i)
    .sort((a,b)=>a.node.getBoundingClientRect().top-b.node.getBoundingClientRect().top)
    .map(x=>({
     ...x,
     key:x.name+':'+(counts[x.name]=(counts[x.name]||0)+1),
     completed:complete(x.node)
  }));
 }

 function modules(){
  const isModuleText=s=>{
   if(!s||typeof s!=='string')return false;
   s=s.split('\n')[0].replace(/\s+/g,' ').trim();
   if(s.length<3||s.length>75)return false;
   if(s.includes('/')||s.includes('>')||/^\s*⌂/i.test(s))return false;
   if(isPracticeTitle(s))return false;
   if(/Reading Material|Cheat Sheet|Video|Lecture|Session|Notes|Overview|Instructions|Submissions|Curriculum|Feedback|Practice Attempts/i.test(s))return false;
   if(/^\d+\s*(?:mins?|hours?)\b/i.test(s))return false;
   return true;
  };

  const rawHeaders=all('button, [role="button"], div, section, header',document).filter(e=>{
   if(!left(e))return false;
   const r=e.getBoundingClientRect();
   if(r.top<65||r.height<28||r.height>85||r.width<140)return false;
   if(e.closest('ol, nav[aria-label*="breadcrumb"], [class*="breadcrumb"]'))return false;
   const t=text(e).split('\n')[0].replace(/\s+/g,' ').trim();
   if(!isModuleText(t))return false;
   if(!all('svg, img',e).length)return false;
   if(all('button, [role="button"]',e).length>2)return false;
   return true;
  });

  const headers=rawHeaders.filter(h=>!rawHeaders.some(other=>other!==h&&h.contains(other)));

  const parsed=[];
  for(const h of headers){
   let titleEl=all('h1,h2,h3,h4,h5,p,span,div',h).find(el=>{
    const t=text(el).split('\n')[0].replace(/\s+/g,' ').trim();
    return isModuleText(t);
   })||h;
   const name=text(titleEl).split('\n')[0].replace(/\s+/g,' ').trim();
   if(!isModuleText(name))continue;
   if(parsed.some(x=>x.name===name))continue;

   const hr=h.getBoundingClientRect();
   const svgs=all('svg',h);
   const chevron=svgs.length>1?svgs.at(-1):svgs[0]||null;
   const target=h.querySelector('button, [role="button"]')||clickable(h)||h;

   parsed.push({
    name,
    node:h,
    target,
    chevron,
    top:hr.top,
    bottom:hr.bottom
   });
  }

  if(!parsed.length){
   for(const e of all('[aria-expanded]',document)){
    if(left(e)&&e.getBoundingClientRect().top>=65&&!e.closest('ol, nav[aria-label*="breadcrumb"], [class*="breadcrumb"]')){
     const name=text(e).split('\n')[0].replace(/\s+/g,' ').trim();
     if(isModuleText(name)&&!parsed.some(x=>x.name===name)){
      const r=e.getBoundingClientRect();
      parsed.push({
       name,
       node:e,
       target:clickable(e)||e,
       chevron:e.querySelector('svg'),
       top:r.top,
       bottom:r.bottom
      });
     }
    }
   }
  }

  parsed.sort((a,b)=>a.top-b.top);

  const found=[];
  for(let i=0;i<parsed.length;i++){
   const item=parsed[i];
   const nextItem=parsed[i+1];
   let isExpanded=false;

   if(nextItem){
    const gap=nextItem.top-item.bottom;
    isExpanded=gap>45;
   }else{
    const belowElements=all('p, span, div, a, button, svg',document).filter(e=>{
     if(!left(e))return false;
     const r=e.getBoundingClientRect();
     return r.top>=item.bottom&&r.top<item.bottom+450&&visible(e);
    });
    isExpanded=belowElements.some(e=>isPracticeTitle(text(e))||/quiz|reading material|session|cheat sheet/i.test(text(e)));
   }

   if(item.node.getAttribute('aria-expanded')==='true'||item.target.getAttribute('aria-expanded')==='true'){
    isExpanded=true;
   }

   found.push({
    name:item.name,
    node:item.node,
    target:item.target,
    chevron:item.chevron,
    expanded:isExpanded,
    top:item.top,
    bottom:item.bottom
   });
  }

  return found;
 }

 function problems(){
  const rows=[];
  const isSolved=(s)=>/solved|completed/i.test(s)&&!/unsolved|not/i.test(s);
  const isIncomplete=(s)=>/in\s*progress|unsolved|not\s*started|not\s*attempted|pending/i.test(s);

  const statusBadges=all('p,span,div,button').filter(e=>visible(e)&&(isSolved(text(e))||isIncomplete(text(e)))&&text(e).length<30&&!Array.from(e.children).some(c=>(isSolved(text(c))||isIncomplete(text(c)))));

  for(const badge of statusBadges){
   const badgeText=text(badge);
   let card=badge;
   while(card&&card!==document.body){
    const r=card.getBoundingClientRect();
    if(r.width>innerWidth*0.35&&r.height>40&&r.height<250&&card.parentElement&&card.parentElement.getBoundingClientRect().width>innerWidth*0.45){
     break;
    }
    card=card.parentElement;
   }
   if(!card||card===document.body)continue;
   if(rows.some(x=>x.node===card))continue;

   const cardText=text(card);
   const solved=isSolved(badgeText)||(!isIncomplete(badgeText)&&complete(card)===true);
   const arrow=all('button,[role=button],a,svg',card).at(-1);
   const link=all('a[href]',card).find(a=>/\/question\/|\/practice\//.test(a.href));
   const target=link||(arrow?clickable(arrow):card);
   
   const titleMatch=cardText.split(/Easy|Medium|Hard|Latest Attempt|\d+\/\d+|-\/-|SOLVED|IN PROGRESS/i)[0].replace(/^[•●\s]+/, '').trim();
   const name=titleMatch||cardText.slice(0, 60);
   const key=link?.href||name;

   rows.push({
    node:card,
    name,
    key,
    completed:solved,
    target
   });
  }

  if(!rows.length){
   const links=all('a[href]').filter(a=>/\/question\/[a-zA-Z0-9_-]+|\/practice\//.test(a.href));
   for(const link of links){
    let card=link;
    while(card&&card!==document.body&&card.getBoundingClientRect().height<250){
     if(card.parentElement&&card.parentElement.getBoundingClientRect().width>innerWidth*0.35)break;
     card=card.parentElement;
    }
    if(card&&!rows.some(x=>x.node===card||x.key===link.href)){
     const t=text(card);
     const title=t.split(/Easy|Medium|Hard|\d+\/\d+|-\/-|SOLVED|IN PROGRESS/i)[0].replace(/^[•●\s]+/, '').trim();
     const solved=isSolved(t)||complete(card)===true;
     rows.push({
      node:card,
      name:title||text(link)||link.href.slice(-20),
      key:link.href,
      completed:solved,
      target:link
     });
    }
   }
  }

  return rows.sort((a,b)=>a.node.getBoundingClientRect().top-b.node.getBoundingClientRect().top);
 }

 function startButton(){
  return all('button').find(e=>{
   const clean=text(e).replace(/[>→»]/g,'').trim();
   return /^(?:RESTART PRACTICE|START OVER|RESTART|START PRACTICE|START|TAKE PRACTICE|RESUME PRACTICE)\b/i.test(clean)&&!e.disabled;
  });
 }

 function saveButton(){
  if(!/Do you want to save code before leaving\?/i.test(document.body.innerText))return null;
  return all('button').find(e=>/^YES$/i.test(text(e)));
 }

 function backButton(){
  const named=all('button,[role=button],a').find(e=>/^back$|go back/i.test(e.getAttribute('aria-label')||e.getAttribute('title')||''));
  if(named)return named;
  const heading=all('h1,h2,h3,span,p,div').filter(e=>/^(?:CODING PRACTICE|MCQ PRACTICE|QUIZ|DAILY PRACTICE|.*PRACTICE)$/i.test(text(e))).find(e=>![...e.children].some(c=>/^(?:CODING PRACTICE|MCQ PRACTICE|QUIZ|DAILY PRACTICE|.*PRACTICE)$/i.test(text(c))));
  if(heading){
   for(let p=heading.parentElement,n=0;p&&n<4;p=p.parentElement,n++){
    const icon=all('svg,img',p).find(e=>e.getBoundingClientRect().right<=heading.getBoundingClientRect().left+15);
    if(icon)return clickable(icon.parentElement)||clickable(icon);
   }
  }
  const endPractice=all('button, [role=button], a').find(e=>/^(?:END PRACTICE|CLOSE|EXIT)$/i.test(text(e)));
  if(endPractice)return endPractice;
  const topLeftButtons=all('button, [role=button], a').filter(e=>{
   const r=e.getBoundingClientRect();
   return r.top<120&&r.left<120&&(e.querySelector('svg, img')||/back/i.test(text(e)));
  });
  if(topLeftButtons.length)return topLeftButtons[0];
  return null;
 }

 function proceedButton(){
  return all('button, [role="button"], a').find(e=>{
   const clean=text(e).replace(/[>→»]/g,'').trim();
   return /^(?:PROCEED|DONE|CONTINUE|NEXT TOPIC|BACK TO COURSE|RETURN TO COURSE)$/i.test(clean)&&!e.disabled;
  });
 }

 function scan(){
  return {
   page:location.pathname,
   kind:ccbpCoding.detected()?'coding':ccbpMCQ.detected()?'mcq':problems().length>0?'coding-list':course()?'course':'unsupported',
   modules:modules().map(({name,expanded})=>({name,expanded})),
   practices:practices().map(({name,key,completed})=>({name,key,completed})),
   problems:problems().map(({name,key,completed})=>({name,key,completed}))
  };
 }

 globalThis.ccbpNav={text,visible,course,courseId,practices,modules,problems,startButton,saveButton,backButton,proceedButton,scan,isCoding,isMCQ,isPracticeTitle};
})();
