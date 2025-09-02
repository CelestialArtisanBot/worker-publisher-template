import Cloudflare from "cloudflare";
import fs from "fs";
import path from "path";

async function deploySnippetToNamespace(
  opts: {
    namespaceName: string;
    scriptName: string;
    code: string;
    bindings?: Array<
      | { type: "plain_text"; name: string; text: string }
      | { type: "kv_namespace"; name: string; namespace_id: string }
      | { type: "r2_bucket"; name: string; bucket_name: string }
    >;
  },
  env: {
    CLOUDFLARE_API_TOKEN: string;
    CLOUDFLARE_ACCOUNT_ID: string;
  }
) {
  const { namespaceName, scriptName, code, bindings = [] } = opts;

  const cf = new Cloudflare({ apiToken: env.CLOUDFLARE_API_TOKEN });

  // Ensure dispatch namespace exists
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

// Run deploy
(async () => {
  const code = fs.readFileSync(path.resolve("./src/index.ts"), "utf8");
  const result = await deploySnippetToNamespace(
    {
      namespaceName: "pick-of-gods-namespace",
      scriptName: "pick-of-gods-chat-worker",
      code,
      bindings: [
        { type: "kv_namespace", name: "KVNAMESPACE", namespace_id: process.env.KVNAMESPACE! },
        { type: "r2_bucket", name: "R2_BUCKET", bucket_name: process.env.R2_BUCKET! },
      ],
    },
    {
      CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN!,
      CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID!,
    }
  );
  console.log("Deployed:", result);
})();
