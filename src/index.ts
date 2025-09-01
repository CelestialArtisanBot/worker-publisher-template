export default {
  async fetch(
    request: Request,
    env: {
      CLOUDFLARE_API_TOKEN: string;
      CLOUDFLARE_ACCOUNT_ID: string;
      KVNAMESPACE: KVNamespace;
      R2_BUCKET: R2Bucket;
      MY_DO: DurableObjectNamespace;
      MESSAGE: string;
      READONLY: string | boolean;
    }
  ) {
    const url = new URL(request.url);
    const pathSegments = url.pathname.split("/").filter(Boolean);
    const isReadOnly = env.READONLY === "true" || env.READONLY === true;

    // HTML UI
    const HTML_UI = `<!DOCTYPE html>
<html>
<head>
  <title>Worker Publisher</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>&#x1F680;</text></svg>">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: "Space Grotesk", sans-serif; background-color: #fef7ed; color: #1a1a1a; padding: 20px; }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { font-size: 3rem; font-weight: 900; color: #1a1a1a; text-shadow: 4px 4px 0px #fb923c; margin-bottom: 2rem; text-transform: uppercase; letter-spacing: -0.02em; }
    .form-group { margin-bottom: 1.5rem; }
    label { display: block; font-weight: 700; font-size: 1.1rem; margin-bottom: 0.5rem; color: #1a1a1a; text-transform: uppercase; letter-spacing: 0.05em; }
    input, textarea { width: 100%; padding: 1rem; border: 4px solid #1a1a1a; background: white; font-family: "JetBrains Mono", monospace; font-size: 1rem; box-shadow: 8px 8px 0px #fb923c; transition: all 0.1s ease; }
    input:focus, textarea:focus { outline: none; transform: translate(-2px, -2px); box-shadow: 12px 12px 0px #fb923c; }
    textarea { height: 300px; resize: vertical; }
    button { background: #fb923c; color: #1a1a1a; border: 4px solid #1a1a1a; padding: 1rem 2rem; font-weight: 900; font-size: 1.1rem; text-transform: uppercase; letter-spacing: 0.05em; cursor: pointer; box-shadow: 8px 8px 0px #1a1a1a; transition: all 0.1s ease; font-family: inherit; }
    button:hover { transform: translate(-2px, -2px); box-shadow: 12px 12px 0px #1a1a1a; }
    button:active { transform: translate(2px, 2px); box-shadow: 4px 4px 0px #1a1a1a; }
    button:disabled { background: #9ca3af; color: #6b7280; cursor: not-allowed; box-shadow: 4px 4px 0px #6b7280; }
    .result { margin-top: 2rem; padding: 1.5rem; border: 4px solid #1a1a1a; background: white; box-shadow: 8px 8px 0px #fb923c; font-weight: 600; }
    .result.success { background: #dcfce7; border-color: #166534; box-shadow: 8px 8px 0px #22c55e; }
    .result.error { background: #fef2f2; border-color: #dc2626; box-shadow: 8px 8px 0px #ef4444; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Worker Publisher</h1>
    <form id="deployForm">
      <div class="form-group">
        <label for="scriptName">Script Name</label>
        <input type="text" id="scriptName" placeholder="pick-of-gods-chat-worker" required>
      </div>
      <div class="form-group">
        <label for="code">Worker Code</label>
        <textarea id="code">export default { async fetch(req, env, ctx) { return new Response(env.MESSAGE || "Hello from free-tier Worker!"); } };</textarea>
      </div>
      <button type="submit"${isReadOnly ? " disabled" : ""}>Deploy Worker</button>
    </form>
    ${isReadOnly ? '<div class="result error">Deployment is disabled in read-only mode</div>' : ""}
    <div id="result"></div>
  </div>
  <script>
    const isReadOnly = ${isReadOnly};
    document.getElementById('deployForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const scriptName = document.getElementById('scriptName').value;
      const code = document.getElementById('code').value;
      const resultDiv = document.getElementById('result');
      resultDiv.innerHTML = '<div style="font-weight: 900;">Saving...</div>';
      if (isReadOnly) return;
      try {
        const resp = await fetch('/deploy', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ scriptName, code })
        });
        const result = await resp.json();
        if (resp.ok) resultDiv.innerHTML = '<div class="result success">' + result.message + '</div>';
        else resultDiv.innerHTML = '<div class="result error">' + result.error + '</div>';
      } catch(err) {
        resultDiv.innerHTML = '<div class="result error">' + err.message + '</div>';
      }
    });
  </script>
</body>
</html>`;

    // Serve UI
    if (pathSegments.length === 0) {
      return new Response(HTML_UI, { headers: { "Content-Type": "text/html" } });
    }

    // Handle deploy endpoint (free-tier: save code to KV)
    if (pathSegments[0] === "deploy" && request.method === "POST") {
      if (isReadOnly) {
        return new Response(JSON.stringify({ error: "Read-only mode" }), { status: 403, headers: { "Content-Type": "application/json" } });
      }
      try {
        const { scriptName, code } = await request.json();
        if (!scriptName || !code) return new Response(JSON.stringify({ error: "Missing scriptName or code" }), { status: 400, headers: { "Content-Type": "application/json" } });
        await env.KVNAMESPACE.put(`worker:${scriptName}`, code);
        return new Response(JSON.stringify({ message: `Saved code for ${scriptName} in KV` }), { headers: { "Content-Type": "application/json" } });
      } catch(err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
    }

    // Default route: test KV & R2 & Durable Object
    try {
      const value = await env.KVNAMESPACE.get("KEY");
      const allKeys = await env.KVNAMESPACE.list();
      return new Response(JSON.stringify({ message: env.MESSAGE, kvValue: value, kvList: allKeys }), { headers: { "Content-Type": "application/json" } });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
  },
};
