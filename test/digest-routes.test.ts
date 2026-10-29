import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { RigConfig } from '../src/config.js';
import type { NightDigest } from '../src/digest/types.js';

const tempDirs: string[] = [];

function makeRunsDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  tempDirs.push(dir);
  return dir;
}

function appFor(runsDir: string) {
  const config: RigConfig = {
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  };
  return createApp(config);
}

function pageJobs(html: string): string[] {
  const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? '';
  return [...tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(([, row]) =>
    row.match(/<td>([^<]*)<\/td>/)?.[1] ?? '',
  );
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('digest routes through createApp', () => {
  it('serves the same ordered fixture rows from HTML and JSON', async () => {
    const runsDir = makeRunsDir();
    copyFileSync('runs/2026-10-28.jsonl', join(runsDir, '2026-10-28.jsonl'));
    const app = appFor(runsDir);

    const [pageResponse, jsonResponse] = await Promise.all([
      app.request('/digest/2026-10-28'),
      app.request('/api/digest/2026-10-28'),
    ]);
    const html = await pageResponse.text();
    const digest = (await jsonResponse.json()) as NightDigest;

    expect(pageResponse.status).toBe(200);
    expect(jsonResponse.status).toBe(200);
    expect(digest.badLines).toBe(1);
    expect(pageJobs(html)).toEqual(digest.rows.map((row) => row.job));
  });

  it('returns 404 from both routes for a missing night', async () => {
    const app = appFor(makeRunsDir());

    const [pageResponse, jsonResponse] = await Promise.all([
      app.request('/digest/2026-10-30'),
      app.request('/api/digest/2026-10-30'),
    ]);

    expect(pageResponse.status).toBe(404);
    expect(jsonResponse.status).toBe(404);
  });

  it('renders an empty night and returns an empty JSON digest', async () => {
    const runsDir = makeRunsDir();
    writeFileSync(join(runsDir, '2026-10-29.jsonl'), '');
    const app = appFor(runsDir);

    const [pageResponse, jsonResponse] = await Promise.all([
      app.request('/digest/2026-10-29'),
      app.request('/api/digest/2026-10-29'),
    ]);
    const digest = (await jsonResponse.json()) as NightDigest;

    expect(pageResponse.status).toBe(200);
    expect(await pageResponse.text()).toContain('nothing ran');
    expect(jsonResponse.status).toBe(200);
    expect(digest).toEqual({ night: '2026-10-29', rows: [], badLines: 0 });
  });

  it('skips malformed lines without failing either route', async () => {
    const runsDir = makeRunsDir();
    writeFileSync(
      join(runsDir, '2026-10-29.jsonl'),
      [
        '{bad json',
        JSON.stringify({ at: '2026-10-29T09:00:00+02:00', job: 'job/a', status: 'ok', owner: null }),
      ].join('\n'),
    );
    const app = appFor(runsDir);

    const [pageResponse, jsonResponse] = await Promise.all([
      app.request('/digest/2026-10-29'),
      app.request('/api/digest/2026-10-29'),
    ]);
    const html = await pageResponse.text();
    const digest = (await jsonResponse.json()) as NightDigest;

    expect(pageResponse.status).toBe(200);
    expect(html).toContain('1 malformed line skipped');
    expect(jsonResponse.status).toBe(200);
    expect(digest.badLines).toBe(1);
    expect(digest.rows.map((row) => row.job)).toEqual(['job/a']);
  });
});
