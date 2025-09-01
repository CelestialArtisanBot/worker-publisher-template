import Cloudflare from "cloudflare";
import { toFile } from "cloudflare/index";

const apiToken = process.env.CLOUDFLARE_API_TOKEN ?? "";
const accountID = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
const scriptName = process.env.WORKER_SCRIPT_NAME ?? "pick-of-gods-chat-worker";

if (!apiToken) throw new Error("Please set CLOUDFLARE_API_TOKEN");
if (!accountID) throw new Error("Please set CLOUDFLARE_ACCOUNT_ID");

const cf = new Cloudflare({ apiToken });

// --- Deploy Worker (free-tier compatible)
export async function deployWorker(opts: {
  code: string;
  bindings?: Array<
    | { type: "plain_text"; name: string; text: string }
    | { type: "kv_namespace"; name: string; namespace_id: string }
    | { type: "r2_bucket"; name: string; bucket_name: string }
    | { type: "durable_object_namespace"; name: string; class_name: string; script_name?: string }
    | { type: "wasm_module"; name: string; part: string }
  >;
}) {
  const { code, bindings = [] } = opts;

  await cf.workers.scripts.update(scriptName, {
    account_id: accountID,
    files: {
      "index.mjs": await toFile(Buffer.from(code), "index.mjs", {
        type: "application/javascript+module",
      }),
    },
    metadata: {
      main_module: "index.mjs",
      bindings,
    },
  });

  console.log(`✅ Worker ${scriptName} deployed successfully.`);
}

// --- Example usage ---
if (require.main === module) {
  const code = `
  const D1_PROXY_URL = "https://your-d1-proxy-worker.your-subdomain.workers.dev";

  export default {
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname.startsWith("/comments")) {
        const res = await fetch(\`\${D1_PROXY_URL}/comments\`);
        const data = await res.json();
        return new Response(JSON.stringify(data), {
          headers: { "Content-Type": "application/json" }
        });
      }

      return new Response("Hello from Publisher Worker!", { status: 200 });
    }
  };
  `;

  deployWorker({
    code,
    bindings: [
      { type: "plain_text", name: "WORKER_ENV", text: "free-tier" },
      { type: "kv_namespace", name: "KVNAMESPACE", namespace_id: "095c5451dd0f4c18b6df88530673001b" },
      { type: "r2_bucket", name: "R2_BUCKET", bucket_name: "r2-explorer-bucket" },
      { type: "durable_object_namespace", name: "MY_DO", class_name: "llmchatapp_MyDurableObject" },
    ],
  }).catch((err) => {
    console.error("❌ Deploy failed:", err);
    process.exit(1);
  });
}
