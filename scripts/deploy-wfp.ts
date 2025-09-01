import Cloudflare from "cloudflare";
import fs from "fs";
import path from "path";

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN!;
const DISPATCH_NAMESPACE = "my-dispatch-namespace";

async function deployWorker(scriptName: string, codePath: string) {
  const cf = new Cloudflare({ apiToken: CF_API_TOKEN });

  // Read worker code
  const code = fs.readFileSync(path.resolve(codePath), "utf-8");

  // Ensure namespace exists
  try {
    await cf.workersForPlatforms.dispatch.namespaces.get(DISPATCH_NAMESPACE, { account_id: CF_ACCOUNT_ID });
  } catch {
    await cf.workersForPlatforms.dispatch.namespaces.create({
      account_id: CF_ACCOUNT_ID,
      name: DISPATCH_NAMESPACE
    });
  }

  const moduleFileName = `${scriptName}.mjs`;

  await cf.workersForPlatforms.dispatch.namespaces.scripts.update(
    DISPATCH_NAMESPACE,
    scriptName,
    {
      account_id: CF_ACCOUNT_ID,
      metadata: { main_module: moduleFileName },
      files: { [moduleFileName]: new File([code], moduleFileName, { type: "application/javascript+module" }) }
    }
  );

  console.log(`✅ Worker ${scriptName} deployed to ${DISPATCH_NAMESPACE}`);
}

// Example usage: node scripts/deploy-wfp.js my-worker ./src/index.ts
const [,, scriptName, codePath] = process.argv;
if (!scriptName || !codePath) throw new Error("Usage: deploy-wfp <scriptName> <codePath>");
deployWorker(scriptName, codePath);
