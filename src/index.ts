// src/index.ts
import Cloudflare from "cloudflare";

// Deploy function
async function deploySnippetToNamespace(
  opts: {
    namespaceName: string;
    scriptName: string;
    code: string;
    bindings?: Array<
      | { type: "plain_text"; name: string; text: string }
      | { type: "kv_namespace"; name: string; namespace_id: string }
      | { type: "r2_bucket"; name: string; bucket_name: string }
      | { type: "durable_object_namespace"; name: string; class_name: string }
    >;
  },
  env: {
    CLOUDFLARE_API_TOKEN: string;
    CLOUDFLARE_ACCOUNT_ID: string;
  }
) {
  const { namespaceName, scriptName, code, bindings = [] } = opts;
  const cf = new Cloudflare({ apiToken: env.CLOUDFLARE_API_TOKEN });

  try {
    await cf.workersForPlatforms.dispatch.namespaces.get(namespaceName, {
      account_id: env.CLOUDFLARE_ACCOUNT_ID,
    });
  } catch {
    await cf.workersForPlatforms.dispatch.namespaces.create({
      account_id: env.CLOUDFLARE_ACCOUNT_ID,
      name: namespaceName,
    });
  }

  const moduleFileName = `${scriptName}.mjs`;

  await cf.workersForPlatforms.dispatch.namespaces.scripts.update(
    namespaceName,
    scriptName,
    {
      account_id: env.CLOUDFLARE_ACCOUNT_ID,
      metadata: { main_module: moduleFileName, bindings },
      files: {
        [moduleFileName]: new File([code], moduleFileName, {
          type: "application/javascript+module",
        }),
      },
    }
  );

  return { namespace: namespaceName, script: scriptName };
}

// HTML Publisher UI
const HTML_UI = ({ isReadOnly }: { isReadOnly: boolean }) => `<!DOCTYPE html>
<html>
<head>
  <title>Worker Publisher</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>&#x1F680;</text></svg>">
  <style>
    body { font-family: "Space Grotesk", sans-serif; background: #fef7ed; color: #1a1a1a; padding: 20px; }
    h1 { font-size: 3rem; text-shadow: 4px 4px 0px #fb923c; }
    input, textarea { width: 100%; padding: 1rem; border: 4px solid #1a1a1a; margin-bottom: 1rem; font-family: "JetBrains Mono", monospace; }
    button { background: #fb923c; color: #1a1a1a; border: 4px solid #1a1a1a; padding: 1rem 2rem; font-weight: 900; cursor: pointer; }
    .result { margin-top: 2rem; padding: 1.5rem; border: 4px solid #1a1a1a; background: white; font-weight: 600; }
    .success { background: #dcfce7; border-color: #166534; }
    .error { background: #fef2f2; border-color: #dc2626; }
  </style>
</head>
<body>
  <h1>Worker Publisher</h1>
  <form id="deployForm">
    <input type="text" id="scriptName" placeholder="pick-of-gods-chat-worker" required>
    <textarea id="code">export default { async fetch(req, env) { return new Response("Hello from Pick of Gods!"); } };</textarea>
    <button type="submit"${isReadOnly ? " disabled" : ""}>Deploy Worker</button>
  </form>
  <div id="result"></div>
  <script>
    const isReadOnly = ${isReadOnly};
    document.getElementById('deployForm').addEventListener('submit', async e => {
      e.preventDefault();
      const scriptName = document.getElementById('scriptName').value;
      const code = document.getElementById('code').value;
      const resultDiv = document.getElementById('result');
      resultDiv.innerHTML = 'Deploying...';
      try {
        const res = await fetch('/deploy', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ scriptName, code }) });
        const data = await res.json();
        if(res.ok) resultDiv.innerHTML = '<div class="result success">Deployed '+data.script+'</div>';
        else resultDiv.innerHTML = '<div class="result error">'+data.error+'</div>';
      } catch(err) { resultDiv.innerHTML = '<div class="result error">'+err.message+'</div>'; }
    });
  </script>
</body>
</html>`;

// Worker Export
export default {
  async fetch(request: Request, env: {
    CLOUDFLARE_API_TOKEN: string;
    CLOUDFLARE_ACCOUNT_ID: string;
    KVNAMESPACE: any;
    R2_BUCKET: any;
    MY_DO: any;
    READONLY: string | boolean;
    MESSAGE: string;
  }) {
    const url = new URL(request.url);
    const path = url.pathname.split('/').filter(Boolean);
    const isReadOnly = env.READONLY === "true" || env.READONLY === true;

    // Serve UI
    if (path.length === 0) return new Response(HTML_UI({ isReadOnly }), { headers: { "Content-Type": "text/html" } });

    // Deploy Endpoint
    if (path[0] === "deploy" && request.method === "POST") {
      if (isReadOnly) return new Response(JSON.stringify({ error: "Read-only mode enabled" }), { status: 403, headers: { "Content-Type": "application/json" } });
      try {
        const { scriptName, code } = await request.json();
        const result = await deploySnippetToNamespace({
          namespaceName: "my-dispatch-namespace",
          scriptName,
          code,
          bindings: [
            { type: "kv_namespace", name: "KV", namespace_id: "095c5451dd0f4c18b6df88530673001b" },
            { type: "r2_bucket", name: "R2_BUCKET", bucket_name: "r2-explorer-bucket" },
            { type: "durable_object_namespace", name: "MY_DO", class_name: "llmchatapp_MyDurableObject" },
            { type: "plain_text", name: "MESSAGE", text: env.MESSAGE }
          ]
        }, env);
        return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
      } catch(e) { return new Response(JSON.stringify({ error: e.message }), { status:500, headers:{ "Content-Type":"application/json" }}); }
    }

    // KV + R2 + DO test endpoint
    if(path[0] === "test") {
      // KV operations
      await env.KVNAMESPACE.put("KEY","VALUE");
      const kvValue = await env.KVNAMESPACE.get("KEY");
      const kvList = await env.KVNAMESPACE.list();
      await env.KVNAMESPACE.delete("KEY");

      // R2 operations (example object)
      await env.R2_BUCKET.put("example.txt", "Pick of Gods R2 content");
      const r2Value = await env.R2_BUCKET.get("example.txt");

      // DO operations (simple fetch)
      const doId = env.MY_DO.idFromName("example");
      const doStub = env.MY_DO.get(doId);
      const doResp = await doStub.fetch(new Request(request.url));

      return new Response(JSON.stringify({
        kvValue,
        kvList,
        r2Value: r2Value ? await r2Value.text() : null,
        doResponse: doResp.status
      }));
    }

    return new Response("Pick of Gods Worker alive!", { status: 200 });
  }
};
