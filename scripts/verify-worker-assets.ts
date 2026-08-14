const assetsDirectory = "apps/web/dist";
const index = Bun.file(`${assetsDirectory}/index.html`);

if (!(await index.exists())) {
  throw new Error(
    `Worker asset verification failed: ${assetsDirectory}/index.html is missing. Run the Vite build before Wrangler deploy.`,
  );
}

const html = await index.text();
if (!html.includes('<div id="root">') || !html.includes("/assets/")) {
  throw new Error(
    `Worker asset verification failed: ${assetsDirectory}/index.html is not a Vite SPA entrypoint.`,
  );
}

console.log(`Worker assets verified in ${assetsDirectory}.`);
