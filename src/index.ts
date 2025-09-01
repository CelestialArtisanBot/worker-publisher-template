import Cloudflare from "cloudflare";

async function deploySnippetToNamespace(
  opts: { namespaceName: string; scriptName: string; code: string },
  env: { CLOUDFLARE_API_TOKEN: string; CLOUDFLARE_ACCOUNT_ID: string }
) {
  const { namespaceName, scriptName, code } = opts;
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
      metadata: { main_module: moduleFileName },
      files: {
        [moduleFileName]: new File([code], moduleFileName, {
          type: "application/javascript+module",
        }),
      },
    },
  );

  return { namespace: namespaceName, script: scriptName };
}

const HTML_UI = ({ isReadOnly }: { isReadOnly: boolean }) => `<!DOCTYPE html>
<html>
<head>
  <title>Worker Publisher</title>
</head>
<body>
<h1>Worker Publisher</h1>
<form id="deployForm">
  <input id="scriptName" placeholder="Script Name" value="${process.env.WORKER_SCRIPT_NAME}" required />
  <textarea id="code"></textarea>
  <button type="submit"${isReadOnly ? " disabled" : ""}>Deploy Worker</button>
</form>
</body>
</html>`;

export default {
  async fetch(request: Request, env: any) {
    const url = new URL(request.url);
    const pathSegments = url.pathname.split("/").filter(Boolean);
    const isReadOnly = env.READONLY === "true";

    if (pathSegments.length === 0) {
      return new Response(HTML_UI({ isReadOnly }), { headers: { "Content-Type": "text/html" } });
    }

    if (pathSegments[0] === "deploy" && request.method === "POST") {
      if (isReadOnly) return new Response(JSON.stringify({ error: "Read-only mode enabled" }), { status: 403 });

      const { scriptName, code } = await request.json();
      const result = await deploySnippetToNamespace({ namespaceName: "my-dispatch-namespace", scriptName, code }, env);
      return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
    }

    try {
      const worker = env.DISPATCHER.get(pathSegments[0]);
      return await worker.fetch(request);
    } catch (e) {
      return new Response("Worker not found", { status: 404 });
    }
  }
};
