const $=(id)=>document.getElementById(id);
function show(el,value){el.textContent=typeof value==="string"?value:JSON.stringify(value,null,2)}
async function getJson(path){const res=await fetch(path);return res.json()}
async function postJson(path,body){const res=await fetch(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});return res.json()}
$("healthBtn").onclick=async()=>show($("statusOut"),await getJson("/api/health"));
$("spaceBtn").onclick=async()=>show($("statusOut"),await getJson("/api/space"));
$("hardwareBtn").onclick=async()=>show($("statusOut"),await getJson("/api/hardware"));
$("modelsBtn").onclick=async()=>show($("statusOut"),await getJson("/api/models"));
$("sendBtn").onclick=async()=>{const prompt=$("prompt").value.trim();const model=$("modelSelect").value;if(!prompt)return show($("chatOut"),"Prompt required.");show($("chatOut"),"Running local inference...");const result=await postJson("/api/chat",{prompt,model});if(!result.ok)return show($("chatOut"),result);show($("chatOut"),`Edition: ${result.edition}\nModel: ${result.model}\nElapsed: ${result.elapsed_ms}ms\n\n${result.response}`)};
