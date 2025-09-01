
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
export interface ChatRequestBody {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}
export interface ChatResponseBody {
  success: boolean;
  error?: string;
  reply?: string;
}

export interface ImageRequestBody {
  prompt: string;
  width?: number;
  height?: number;
  steps?: number;
  seed?: number;
}
export interface ImageResponseBody {
  success: boolean;
  error?: string;
  imageBase64?: string;
}

export interface DeployRequestBody {
  scriptName: string;
  code: string;
  routes?: string[];
}
export interface DeployResponseBody {
  success: boolean;
  error?: string;
  scriptName?: string;
  workerId?: string;
  routes?: string[];
}

export interface AuthRequestBody {
  email: string;
  password?: string;
}
export interface AuthResponseBody {
  success: boolean;
  error?: string;
  session?: {
    sessionId: string;
    subject: any;
    issuedAt: string;
    expiresAt: string;
  };
}

export interface WorkerEnv {
  ASSETS: Fetcher;
  AI: Ai;
  KV_STORE: KVNamespace;
  AUTH_STORAGE: KVNamespace;
  DB: D1Database;
  R2_BUCKET: R2Bucket;
  DISPATCHER: KVNamespace | DurableObjectNamespace;
}

export interface Ai {
  run(model: string, input: Record<string, unknown>, opts?: Record<string, unknown>): Promise<any>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
}

export interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = unknown>(): Promise<D1Result<T>>;
  raw<T = unknown>(): Promise<T[]>;
}

export interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  error?: string;
  meta?: unknown;
}
