
export class llmchatapp_MyDurableObject {
  state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);

    if (request.method === "POST") {
      const data = await request.json();
      const timestamp = Date.now().toString();
      await this.state.storage.put(timestamp, data);
      return new Response(JSON.stringify({ success: true, stored: data }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const allData: Record<string, any> = {};
    for await (const { key, value } of this.state.storage.list()) {
      allData[key] = value;
    }

    return new Response(JSON.stringify(allData), { headers: { "Content-Type": "application/json" } });
  }
}
