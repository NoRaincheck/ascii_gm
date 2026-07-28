const PORT = 8080;

const mimeTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
};

const DOCS = 'docs';

async function main() {
  console.log(`Dev server: http://localhost:${PORT}/`);
  console.log(`Serving from: ${DOCS}/`);
  console.log(`Rebuild with: deno task build`);

  Deno.serve({ hostname: 'localhost', port: PORT }, async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    let path = url.pathname;
    if (path === '/') path = '/index.html';

    const filePath = `${DOCS}${path}`;

    try {
      const stat = await Deno.stat(filePath);
      if (!stat.isFile) return new Response('Not Found', { status: 404 });

      const ext = filePath.slice(filePath.lastIndexOf('.'));
      const contentType = mimeTypes[ext] ?? 'application/octet-stream';

      const body = await Deno.readFile(filePath);
      return new Response(body, {
        headers: {
          'content-type': contentType,
          'cache-control': 'no-cache',
        },
      });
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  });
}

main();
