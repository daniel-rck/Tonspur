export interface Env {
  ASSETS: Fetcher;
  // Set later for the YouTube search proxy:
  // YT_API_KEY: string;  // → `wrangler secret put YT_API_KEY`
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/healthz") {
      return Response.json({ ok: true });
    }

    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, ctx);
    }

    // Fall through to Workers Assets (static SPA bundle).
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

async function handleApi(request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);

  // Reserved for the future live search. The client would call
  // /api/search?q=... and the Worker would proxy YouTube Data API v3
  // (search.list) using YT_API_KEY (a Wrangler secret, never shipped to the
  // client) and cache results. Until then this returns 501.
  if (url.pathname === "/api/search") {
    return Response.json({ error: "not_implemented" }, { status: 501 });
  }

  return Response.json({ error: "not_found" }, { status: 404 });
}
