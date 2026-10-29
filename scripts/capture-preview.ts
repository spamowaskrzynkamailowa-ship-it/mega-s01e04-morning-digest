import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

const outputArg = process.argv[2] === '--' ? process.argv[3] : process.argv[2];
if (!outputArg) {
  throw new Error('Usage: pnpm preview:capture -- <absolute-output-file-outside-repo>');
}

const output = resolve(outputArg);
if (!isAbsolute(outputArg)) {
  throw new Error('The preview output path must be absolute and outside the repository.');
}
const repoRoot = resolve(process.cwd());
const relativeOutput = relative(repoRoot, output);
if (relativeOutput === '' || (!relativeOutput.startsWith(`..${sep}`) && relativeOutput !== '..')) {
  throw new Error('The preview output must be outside the repository.');
}

const response = await createApp(loadConfig()).request('/digest/2026-10-28');
if (!response.ok) {
  throw new Error(`The digest route returned HTTP ${response.status}.`);
}

const html = await response.text();
if (!/^<!doctype html>/i.test(html) || /<script\b/i.test(html)) {
  throw new Error('The preview must be a complete HTML document without client JavaScript.');
}

await mkdir(dirname(output), { recursive: true });
await writeFile(output, html, 'utf8');
console.log(`Captured /digest/2026-10-28 (${Buffer.byteLength(html)} bytes).`);
