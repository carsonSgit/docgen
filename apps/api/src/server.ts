const port = Number(process.env.PORT ?? 3000);

export function handleRequest(request: Request): Response {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/health") {
    return Response.json({ status: "ok" });
  }

  return Response.json({ error: "Not found" }, { status: 404 });
}

if (import.meta.main) {
  Bun.serve({
    fetch: handleRequest,
    port,
  });

  console.log(`API listening on http://localhost:${port}`);
}
