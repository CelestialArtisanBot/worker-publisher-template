export class MyDurableObject {
  state: DurableObjectState;
  storage: DurableObjectStorage;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.storage = state.storage;
  }

  // Durable Object fetch handler
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/set") {
      const { key, value } = await request.json<any>();
      await this.storage.put(key, value);
      return new Response(
        JSON.stringify({ success: true, key, value }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    if (request.method === "GET" && url.pathname.startsWith("/get")) {
      const key = url.searchParams.get("key");
      if (!key) return new Response("Missing key", { status: 400 });
      const value = await this.storage.get(key);
      return new Response(
        JSON.stringify({ key, value }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    if (request.method === "GET" && url.pathname === "/list") {
      const list = await this.storage.list();
      return new Response(
        JSON.stringify(Object.fromEntries(list)),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/delete")) {
      const key = url.searchParams.get("key");
      if (!key) return new Response("Missing key", { status: 400 });
      await this.storage.delete(key);
      return new Response(
        JSON.stringify({ deleted: key }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response("Not Found", { status: 404 });
  }
}
