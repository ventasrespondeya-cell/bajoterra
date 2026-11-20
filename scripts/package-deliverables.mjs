import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import * as esbuild from 'esbuild';

const root = process.cwd();
const distAssets = path.join(root, 'dist', 'assets');
const publicDir = path.join(root, 'public');

if (!fs.existsSync(distAssets)) {
  throw new Error('dist/assets not found. Run npm run build first.');
}

const cssFile = fs.readdirSync(distAssets).find((f) => f.endsWith('.css'));
if (!cssFile) {
  throw new Error('Compiled CSS file not found in dist/assets.');
}
const cssContent = fs.readFileSync(path.join(distAssets, cssFile), 'utf8');

const result = await esbuild.build({
  entryPoints: [path.join(root, 'src', 'main.tsx')],
  bundle: true,
  minify: true,
  write: false,
  format: 'iife',
  target: ['es2020'],
  charset: 'utf8',
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
    '.css': 'empty',
  },
});

const jsBundle = result.outputFiles[0].text;
// Escape </script> sequences safely inside inline script
const safeJs = jsBundle.replace(/<\/script/gi, '<\\/script');

const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <meta name="theme-color" content="#091119" />
    <title>Bajoterra 4.0 — Mundo Vivo</title>
    <style>${cssContent}</style>
  </head>
  <body class="bg-[#070d14] text-[#e7f2f5] antialiased selection:bg-[#38d3df]/30">
    <div id="root"></div>
    <script>${safeJs}</script>
  </body>
</html>`;

const outHtmlPath = path.join(publicDir, 'Bajoterra_4_0.html');
fs.writeFileSync(outHtmlPath, html, 'utf8');
console.log(`Generated standalone ${outHtmlPath} (${Math.round(html.length / 1024)} KB)`);

// Also package ZIP with Bajoterra_4_0.html, LEEME_Bajoterra_4_0.txt, and src/
const zipOut = path.join(publicDir, 'Bajoterra_4_0_Proyecto.zip');
if (fs.existsSync(zipOut)) fs.unlinkSync(zipOut);

try {
  execSync(
    `python3 -c "import zipfile, os; z = zipfile.ZipFile('public/Bajoterra_4_0_Proyecto.zip', 'w', zipfile.ZIP_DEFLATED); z.write('public/Bajoterra_4_0.html', 'Bajoterra_4_0.html'); z.write('public/LEEME_Bajoterra_4_0.txt', 'LEEME_Bajoterra_4_0.txt'); [z.write(os.path.join(dp, f), os.path.join(dp, f)) for d in ('src', 'tests') if os.path.exists(d) for dp, dn, fn in os.walk(d) for f in fn]; z.write('package.json', 'package.json'); z.write('index.html', 'index.html'); z.close()"`,
    { cwd: root, stdio: 'inherit' }
  );
  console.log(`Generated ${zipOut}`);
} catch (err) {
  console.error('ZIP creation failed:', err);
}
