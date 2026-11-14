import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const libraryPath = path.join(projectRoot, 'tgm-ExampleLibrary-2026-11-11.json');
const presetDir = path.join(projectRoot, 'presets');
const presetPath = path.join(presetDir, '7-days-to-die-v3.4-protocol.json');
const protocolId = 'game-c054-sjrj5f2';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function extractProtocol() {
  const library = readJson(libraryPath);
  const protocol = library.find((bundle) => bundle.id === protocolId);
  if (!protocol) {
    throw new Error(`Protocol ${protocolId} was not found in ${libraryPath}.`);
  }

  fs.mkdirSync(presetDir, { recursive: true });
  writeJson(presetPath, protocol);
  console.log(`Extracted 7 Days to Die protocol to ${presetPath}`);
}

function syncProtocol() {
  const protocol = readJson(presetPath);
  if (protocol.id !== protocolId) {
    throw new Error(`Expected protocol id ${protocolId}, received ${String(protocol.id)}.`);
  }

  const library = readJson(libraryPath);
  const index = library.findIndex((bundle) => bundle.id === protocolId);
  if (index < 0) {
    throw new Error(`Protocol ${protocolId} was not found in ${libraryPath}.`);
  }

  library[index] = protocol;
  writeJson(libraryPath, library);
  console.log(`Synchronized ${presetPath} into the example library.`);
}

if (process.argv.includes('--extract')) {
  extractProtocol();
} else {
  syncProtocol();
}
