import fs from "fs";
import path from "path";
import Cloudflare from "cloudflare";

// Environment variables (hardcoded to your info)
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN!;
const ACCOUNT_ID = "celestialartisanbot@gmail.com"; // Your account ID
if (!API_TOKEN) throw new Error("Set CLOUDFLARE_API_TOKEN in your environment");

// Initialize Cloudflare client
const cf = new Cloudflare({ apiToken: API_TOKEN });

interface DeployOptions {
  scriptName: string;
  filePath: string;
  bindings?: Array<
    | { type: "plain_text"; name: string; text: string }
    | { type: "kv_namespace"; name: string; namespace_id: string }
    | { type: "r2_bucket"; name: string; bucket_name: string }
  >;
}

async function deployToNamespace(opts: DeployOptions) {
  const { scriptName, filePath, bindings = [] } = opts;
  const code = fs.readFileSync(path.resolve(filePath), "utf8");
  const moduleFileName = `${scriptName}.mjs`;
  const namespaceName = "my-dispatch-namespace";

  // Ensure namespace exists
  try {
    await cf.workersForPlatforms.dispatch.namespaces.get(namespaceName, { account_id: ACCOUNT_ID });
  } catch {
    await cf.workersForPlatforms.dispatch.namespaces.create({ account_id: ACCOUNT_ID, name: namespaceName });
  }

  // Upload the script
  await cf.workersForPlatforms.dispatch.namespaces.scripts.update(namespaceName, scriptName, {
    account_id: ACCOUNT_ID,
    metadata: { main_module: moduleFileName, bindings },
    files: { [moduleFileName]: new File([code], moduleFileName, { type: "application/javascript+module" }) },
  });

  console.log(`✅ Deployed "${scriptName}" to Dispatch namespace "${namespaceName}"`);
}

// Run deploy from CLI
const scriptName = process.argv[2] || "example-worker";
const filePath = process.argv[3] || "./src/index.ts";

deployToNamespace({ scriptName, filePath, bindings: [
  { type: "plain_text", name: "READONLY", text: "true" },
  { type: "kv_namespace", name: "KVNAMESPACE", namespace_id: "095c5451dd0f4c18b6df88530673001b" },
  { type: "r2_bucket", name: "R2_BUCKET", bucket_name: "r2-explorer-bucket" }
]}).catch(console.error);
