export interface DeployOptions {
  namespaceName: string;
  scriptName: string;
  code: string;
  bindings?: Array<{ type: string; name: string; text?: string; namespace_id?: string; bucket_name?: string }>;
}

export interface Env {
  CLOUDFLARE_API_TOKEN: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  KVNAMESPACE: string;
  R2_BUCKET: string;
  MY_DO: any;
  READONLY: string | boolean;
  MESSAGE: string;
  D1_DB_ID: string;
}
