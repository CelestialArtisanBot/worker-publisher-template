import Cloudflare from "cloudflare";
import fs from "fs";

const env = process.env;

if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) {
  throw new Error("Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID in env");
}

const cf = new Cloudflare({ apiToken: env.CLOUDFLARE_API_TOKEN });

async function deployWorker(scriptName: string, code: string) {
  const namespaceName = "my-dispatch-namespace";

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

  console.log(`✅ Worker '${scriptName}' deployed successfully!`);
}

// Read your Worker code
const code = fs.readFileSync("./src/index.ts", "utf-8");
deployWorker(env.WORKER_SCRIPT_NAME!, code);
