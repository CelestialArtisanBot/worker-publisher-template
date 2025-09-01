export class llmchatapp_MyDurableObject {
  state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    return new Response(`Durable Object response for path: ${url.pathname}`, { status: 200 });
  }
}
