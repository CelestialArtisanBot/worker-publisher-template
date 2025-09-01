{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "pick-of-gods-chat-worker",
  "main": "./src/index.ts",
  "compatibility_date": "2025-04-01",
  "upload_source_maps": true,
  "vars": {
    "CLOUDFLARE_ACCOUNT_ID": "deee1798a610f6c7842da5b3777ef377",
    "READONLY": "false",
    "MESSAGE": "Hello from free-tier Worker!"
  },
  "kv_namespaces": [
    {
      "binding": "KV",
      "id": "095c5451dd0f4c18b6df88530673001b"
    }
  ],
  "r2_buckets": [
    {
      "binding": "R2_BUCKET",
      "bucket_name": "r2-explorer-bucket"
    }
  ],
  "durable_objects": [
    {
      "name": "MY_DO",
      "class_name": "llmchatapp_MyDurableObject"
    }
  ],
  "scripts": {
    "deploy": "wrangler deploy",
    "dev": "wrangler dev"
  },
  "dev": {
    "ip": "0.0.0.0"
  }
}
