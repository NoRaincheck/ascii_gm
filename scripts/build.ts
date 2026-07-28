const DOCS = 'docs';

async function main() {
  await Deno.mkdir(DOCS, { recursive: true });

  const esbuild = await import('npm:esbuild');

  const result = await esbuild.build({
    entryPoints: ['www/app.js'],
    bundle: true,
    outfile: `${DOCS}/app.js`,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    external: ['npm:*'],
  });

  if (result.errors.length > 0) {
    console.error('Build errors:', result.errors);
    Deno.exit(1);
  }
  console.log('Bundle written to docs/app.js');

  await Deno.copyFile('www/index.html', `${DOCS}/index.html`);
  await Deno.copyFile('www/style.css', `${DOCS}/style.css`);
  await Deno.copyFile('wang_3050_BIOS_ROM__8x16.png', `${DOCS}/spritesheet.png`);
  await Deno.copyFile('ironsworn_oracles.json', `${DOCS}/ironsworn_oracles.json`);

  console.log('Assets copied to docs/');
  console.log('Done. Serve docs/ as a static site for GitHub Pages.');
}

main();
