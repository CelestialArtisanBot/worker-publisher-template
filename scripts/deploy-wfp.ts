#!/usr/bin/env tsx
import { writeFile } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const WORKER_SCRIPT_NAME = process.env.WORKER_SCRIPT_NAME || "pick-of-gods-chat-worker";
const READONLY = process.env.READONLY || "false";

if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID) {
  console.error("Missing Cloudflare credentials. Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.");
  process.exit(1);
}

async function main() {
  try {
    console.log("📦 Building Worker project...");
    await execAsync("npm run build");

    console.log(`🚀 Deploying Worker "${WORKER_SCRIPT_NAME}" to account ${CLOUDFLARE_ACCOUNT_ID}...`);

    // Write temporary wrangler.toml for this deployment
    const wranglerToml = `
name = "${WORKER_SCRIPT_NAME}"
main = "dist/index.js"
compatibility_date = "2025-09-02"
account_id = "${CLOUDFLARE_ACCOUNT_ID}"

[env]
READONLY = "${READONLY}"
`;
    await writeFile("wrangler.toml", wranglerToml);

    // Deploy with wrangler
    const { stdout, stderr } = await execAsync(`wrangler deploy`);
    console.log(stdout);
    if (stderr) console.error(stderr);

    console.log("✅ Deployment complete!");
  } catch (err: any) {
    console.error("❌ Deployment failed:", err.message || err);
    process.exit(1);
  }
}

main();
