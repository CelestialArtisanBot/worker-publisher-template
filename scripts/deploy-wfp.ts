import Cloudflare from "cloudflare";
import { toFile } from "cloudflare/index";

const apiToken = process.env.CLOUDFLARE_API_TOKEN ?? "";
const accountID = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
const scriptName = process.env.WORKER_SCRIPT_NAME ?? "pick-of-gods-chat-worker";

if (!apiToken) throw new Error("Please set CLOUDFLARE_API_TOKEN");
if (!accountID) throw new Error("Please set CLOUDFLARE_ACCOUNT_ID");

const cf = new Cloudflare({ apiToken });

export async function deployWorker(opts: {
  code: string;
  bindings?: Array<
    | { type: "plain_text"; name: string; text: string }
    | { type: "kv_namespace"; name: string; namespace_id: string }
    | { type: "r2_bucket"; name: string; bucket_name: string }
    | { type: "durable_object_namespace"; name: string; class_name: string; script_name?: string }
    | { type: "d1_database"; name: string; database_name: string }
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

if (require.main === module) {
  const code = `
  export default {
    async fetch(req, env) {
      const message = env.MESSAGE ?? "Hello from Chat Worker!";
      return new Response(message, { status: 200 });
    }
  };
  `;

  deployWorker({
    code,
    bindings: [
      { type: "plain_text", name: "MESSAGE", text: "Hello World!" },
      { type: "kv_namespace", name: "KV_STORE", namespace_id: process.env.KVNAMESPACE! },
      { type: "r2_bucket", name: "R2_BUCKET", bucket_name: process.env.R2_BUCKET! },
      { type: "durable_object_namespace", name: "MY_DO", class_name: process.env.MY_DO! },
      { type: "d1_database", name: "DB", database_name: process.env.D1_DB_ID! },
      { type: "plain_text", name: "WORKER_ENV", text: "free-tier" },
    ],
  }).catch(console.error);
}
