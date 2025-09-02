import deploySnippetToNamespace from "../scripts/deploy-wfp";

const HTML_UI = ({ isReadOnly }: { isReadOnly: boolean }) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Pick of Gods Worker Publisher</title>
<style>
body{font-family:sans-serif;background:#fef7ed;color:#1a1a1a;padding:2rem;}
input,textarea,button{padding:1rem;margin:0.5rem 0;}
button:disabled{opacity:0.5;cursor:not-allowed;}
.result{margin-top:1rem;padding:1rem;border:2px solid #1a1a1a;}
.result.success{background:#dcfce7;}
.result.error{background:#fef2f2;}
</style>
</head>
<body>
<h1>Worker Publisher</h1>
<form id="deployForm">
<input id="scriptName" placeholder="Script Name" required/>
<textarea id="code" rows="10">${MESSAGE || "export default {}"}</textarea>
<button type="submit"${isReadOnly ? " disabled" : ""}>Deploy Worker</button>
</form>
<div id="result"></div>
<script>
const form=document.getElementById('deployForm');
form.addEventListener('submit',async e=>{
e.preventDefault();
const scriptName=document.getElementById('scriptName').value;
const code=document.getElementById('code').value;
const resultDiv=document.getElementById('result');
resultDiv.innerHTML='Deploying...';
try{
const res=await fetch('/deploy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scriptName,code})});
const data=await res.json();
if(res.ok){resultDiv.innerHTML='<div class="result success">Successfully deployed '+data.script+'</div>';setTimeout(()=>window.location.href='/'+data.script,2000);}
else resultDiv.innerHTML='<div class="result error">Error: '+data.error+'</div>';
}catch(err){resultDiv.innerHTML='<div class="result error">Error: '+err.message+'</div>';}
});
</script>
</body>
</html>`;

export default {
  async fetch(request: Request, env: any) {
    const url = new URL(request.url);
    const path = url.pathname.split("/").filter(Boolean);
    const isReadOnly = env.READONLY === "true" || env.READONLY === true;

    if (path.length === 0) return new Response(HTML_UI({ isReadOnly }), { headers: { "Content-Type": "text/html" } });

    if (path[0] === "deploy" && request.method === "POST") {
      if (isReadOnly) return new Response(JSON.stringify({ error: "Read-only mode" }), { status: 403, headers: { "Content-Type": "application/json" } });
      const { scriptName, code } = await request.json();
      const result = await deploySnippetToNamespace(
        { namespaceName: "pick-of-gods-namespace", scriptName, code },
        { CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID }
      );
      return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
    }

    // Dispatch to durable object if exists
    const worker = env.MY_DO;
    if (worker) return await worker.fetch(request);

    return new Response("Not Found", { status: 404 });
  },
};
