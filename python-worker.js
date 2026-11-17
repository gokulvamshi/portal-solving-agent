importScripts('python-runtime/pyodide.js');
const ready=(async()=>{
 const py=await loadPyodide({indexURL:new URL('python-runtime/',self.location.href).href});
 py.runPython(await (await fetch('python-check.py')).text());
 return py;
})();
self.onmessage=async e=>{
 try{
  const py=await ready;
  self.postMessage({id:e.data.id,ready:true});
  const check=py.globals.get('check_output');
  try{self.postMessage({id:e.data.id,result:JSON.parse(check(e.data.code))});}finally{check.destroy();}
 }catch(error){self.postMessage({id:e.data.id,result:{supported:false,reason:error.message}});}
};
