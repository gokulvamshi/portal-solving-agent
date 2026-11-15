const status=document.querySelector('#status');
async function send(action){try{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});if(!tab?.url?.startsWith('https://learning.ccbp.in/'))throw Error('Open the CCBP practice tab.');const r=await chrome.tabs.sendMessage(tab.id,{action});status.textContent=r?.status||'Waiting';}catch(e){status.textContent=e.message+'\nIf just installed, refresh the practice tab.';}}
document.querySelector('#start').onclick=()=>send('start');
document.querySelector('#stop').onclick=()=>send('stop');
send('status');setInterval(()=>send('status'),1000);
