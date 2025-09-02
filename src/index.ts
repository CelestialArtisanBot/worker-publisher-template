export default {
  async fetch(
    request: Request,
    env: {
      CLOUDFLARE_ACCOUNT_ID: string;
      KV: KVNamespace;
      R2_BUCKET: R2Bucket;
      D1_DB: D1Database;
      READONLY: string | boolean;
      MESSAGE: string;
    }
  ) {
    const url = new URL(request.url);
    const path = url.pathname.split("/").filter(Boolean);
    const isReadOnly = env.READONLY === "true" || env.READONLY === true;

    if (path.length === 0) {
      return new Response(
        `<h1>${env.MESSAGE}</h1><p>Pick-of-Gods Chat Backend</p>`,
        { headers: { "Content-Type": "text/html" } }
      );
    }

    // Chat endpoints
    if (path[0] === "chat") {
      if (request.method === "POST") {
        if (isReadOnly) {
          return new Response(
            JSON.stringify({ error: "Read-only mode enabled" }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          );
        }
        try {
          const { user, message } = await request.json();
          const timestamp = Date.now();

          // D1 insert using your D1_DB_ID
          await env.D1_DB.prepare(
            `INSERT INTO messages (user, message, timestamp) VALUES (?, ?, ?)`
          ).bind(user, message, timestamp).run();

          // KV caching using your namespace OpenAuth Server
          await env.KV.put(`last_${user}`, message, { expirationTtl: 3600 });

          // R2 log using your bucket r2-explorer-bucket
          const key = `logs/${timestamp}_${user}.txt`;
          await env.R2_BUCKET.put(key, message);

          return new Response(JSON.stringify({ status: "ok" }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      if (request.method === "GET") {
        try {
          const res = await env.D1_DB.prepare(
            `SELECT * FROM messages ORDER BY timestamp DESC LIMIT 20`
          ).all();
          const messages = res.results;

          const cachedKeys = await env.KV.list({ limit: 10 });
          const cachedData: Record<string, string> = {};
          for (const key of cachedKeys.keys) {
            cachedData[key.name] = await env.KV.get(key.name);
          }

          return new Response(
            JSON.stringify({ messages, cachedData }),
            { headers: { "Content-Type": "application/json" } }
          );
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
    }

    // KV endpoint
    if (path[0] === "kv") {
      if (request.method === "POST") {
        const { key, value } = await request.json();
        await env.KV.put(key, value);
        return new Response(JSON.stringify({ status: "ok" }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      if (request.method === "GET") {
        const key = url.searchParams.get("key");
        const value = key ? await env.KV.get(key) : null;
        return new Response(JSON.stringify({ key, value }), {
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // R2 endpoint
    if (path[0] === "r2") {
      if (request.method === "POST") {
        const formData = await request.formData();
        const file = formData.get("file") as File;
        if (!file) return new Response("Missing file", { status: 400 });

        await env.R2_BUCKET.put(file.name, file.stream());
        return new Response(JSON.stringify({ status: "ok", file: file.name }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      if (request.method === "GET") {
        const key = url.searchParams.get("key");
        if (!key) return new Response("Missing key", { status: 400 });

        const object = await env.R2_BUCKET.get(key);
        if (!object) return new Response("File not found", { status: 404 });

        return new Response(object.body, {
          headers: { "Content-Type": "application/octet-stream" },
        });
      }
    }

    return new Response("Not found", { status: 404 });
  },
};
