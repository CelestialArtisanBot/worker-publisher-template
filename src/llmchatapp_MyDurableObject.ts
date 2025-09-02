export class llmchatapp_MyDurableObject {
  storage: DurableObjectStorage;
  constructor(state: DurableObjectState) {
    this.storage = state.storage;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    if (url.pathname === "/kv") {
      await this.storage.put("KEY", "VALUE");
      const value = await this.storage.get("KEY");
      const allKeys = await this.storage.list();
      return new Response(JSON.stringify({ value, allKeys }));
    }

    if (url.pathname === "/r2") {
      // Example: list R2 bucket files
      return new Response("R2 integration placeholder", { status: 200 });
    }

    return new Response("Durable Object Active", { status: 200 });
  }
}
