export class MyDurableObject {
  state: DurableObjectState;
  env: {
    KV: KVNamespace;
    R2_BUCKET: R2Bucket;
    D1_DB: D1Database;
    MESSAGE: string;
    READONLY: string | boolean;
  };

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    const path = url.pathname.split("/").filter(Boolean);
    const isReadOnly = this.env.READONLY === "true" || this.env.READONLY === true;

    // Health check / landing
    if (path.length === 0) {
      return new Response(
        `<h1>${this.env.MESSAGE}</h1><p>Pick-of-Gods Live Chat Durable Object</p>`,
        { headers: { "Content-Type": "text/html" } }
      );
    }

    // Chat messages endpoint
    if (path[0] === "chat") {
      if (request.method === "POST") {
        if (isReadOnly) {
          return new Response(JSON.stringify({ error: "Read-only mode enabled" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const { user, message } = await request.json();
          const timestamp = Date.now();

          // Save to D1
          await this.env.D1_DB.prepare(
            `INSERT INTO messages (user, message, timestamp) VALUES (?, ?, ?)`
          ).bind(user, message, timestamp).run();

          // Cache in KV for quick access
          await this.env.KV.put(`last_${user}`, message, { expirationTtl: 3600 });

          // Save log to R2
          const key = `logs/${timestamp}_${user}.txt`;
          await this.env.R2_BUCKET.put(key, message);

          return new Response(JSON.stringify({ status: "ok", user, timestamp }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      if (request.method === "GET") {
        try {
          // Fetch latest 20 messages from D1
          const res = await this.env.D1_DB.prepare(
            `SELECT * FROM messages ORDER BY timestamp DESC LIMIT 20`
          ).all();
          const messages = res.results;

          // Fetch recent KV cache
          const cachedKeys = await this.env.KV.list({ limit: 10 });
          const cachedData: Record<string, string | null> = {};
          for (const key of cachedKeys.keys) {
            cachedData[key.name] = await this.env.KV.get(key.name);
          }

          return new Response(JSON.stringify({ messages, cachedData }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
    }

    // KV direct access
    if (path[0] === "kv") {
      if (request.method === "POST") {
        const { key, value } = await request.json();
        await this.env.KV.put(key, value);
        return new Response(JSON.stringify({ status: "ok", key }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      if (request.method === "GET") {
        const key = url.searchParams.get("key");
        const value = key ? await this.env.KV.get(key) : null;
        return new Response(JSON.stringify({ key, value }), {
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // R2 direct access
    if (path[0] === "r2") {
      if (request.method === "POST") {
        const formData = await request.formData();
        const file = formData.get("file") as File;
        if (!file) return new Response("Missing file", { status: 400 });
        await this.env.R2_BUCKET.put(file.name, file.stream());
        return new Response(JSON.stringify({ status: "ok", file: file.name }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      if (request.method === "GET") {
        const key = url.searchParams.get("key");
        if (!key) return new Response("Missing key", { status: 400 });
        const object = await this.env.R2_BUCKET.get(key);
        if (!object) return new Response("File not found", { status: 404 });
        return new Response(object.body, {
          headers: { "Content-Type": "application/octet-stream" },
        });
      }
    }

    return new Response("Not found", { status: 404 });
  }
}
