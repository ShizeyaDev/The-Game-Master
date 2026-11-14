import fs from 'node:fs';
import path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.join(__dirname, 'src');
const DIST_DIR = path.join(__dirname, 'dist');
const CSS_PATH = path.join(__dirname, 'styles', 'main.css');
const STANDALONE_HTML_PATH = path.join(__dirname, 'the-game-master.html');

function cleanWhitespace(code) {
  return code
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function compileDirectory(srcDir, outDir) {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    if (entry.isDirectory()) {
      compileDirectory(srcPath, path.join(outDir, entry.name));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      const rawTs = fs.readFileSync(srcPath, 'utf8');
      const strippedJs = stripTypeScriptTypes(rawTs, { mode: 'strip' });
      const browserReadyJs = cleanWhitespace(
        strippedJs.replace(
          /(from\s+['"])(\.[^'"]+)\.ts(['"])/g,
          '$1$2.js$3'
        )
      );
      const outFileName = entry.name.replace(/\.ts$/, '.js');
      const outPath = path.join(outDir, outFileName);
      fs.writeFileSync(outPath, `${browserReadyJs}\n`, 'utf8');
    }
  }
}

const BUNDLE_ORDER = [
  'core/types.ts',
  'core/rng.ts',
  'core/constraints.ts',
  'core/difficulty.ts',
  'core/seed.ts',
  'core/storage.ts',
  'ui/icons.ts',
  'ui/validation.ts',
  'ui/roll-engine.ts',
  'ui/dossier.ts',
  'ui/app.ts',
  'main.ts',
];

function buildStandaloneBundle() {
  const chunks = [];
  for (const relPath of BUNDLE_ORDER) {
    const fullPath = path.join(SRC_DIR, relPath);
    const rawTs = fs.readFileSync(fullPath, 'utf8');
    let stripped = stripTypeScriptTypes(rawTs, { mode: 'strip' });

    stripped = stripped
      .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
      .replace(/^\s*export\s+\*\s+from\s+['"][^'"]+['"];?\s*$/gm, '')
      .replace(/^\s*export\s+(const|let|var|function|class)\s+/gm, '$1 ');

    const cleanedChunk = cleanWhitespace(stripped);
    if (cleanedChunk.length > 0) {
      chunks.push(cleanedChunk);
    }
  }

  const iife = `(function () {\n'use strict';\n\n${chunks.join('\n\n')}\n\n})();\n`;
  fs.writeFileSync(path.join(DIST_DIR, 'bundle.js'), iife, 'utf8');
  return iife;
}

function buildSingleFileHtml(iifeBundle) {
  const cssContent = fs.readFileSync(CSS_PATH, 'utf8');
  const safeJsContent = iifeBundle.replace(/<\/script>/gi, '<\\/script>');
  const safeCssContent = cssContent.replace(/<\/style>/gi, '<\\/style>');

  const standaloneHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>The Game Master</title>
    <style>
${safeCssContent.trim()}
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script>
${safeJsContent.trim()}
    </script>
  </body>
</html>
`;

  fs.writeFileSync(STANDALONE_HTML_PATH, standaloneHtml, 'utf8');
}

compileDirectory(SRC_DIR, DIST_DIR);
const iifeBundle = buildStandaloneBundle();
buildSingleFileHtml(iifeBundle);
console.log(
  'Build complete: emitted modular dist/*.js, dist/bundle.js, and standalone the-game-master.html'
);
