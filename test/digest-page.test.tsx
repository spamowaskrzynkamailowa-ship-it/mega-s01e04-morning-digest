import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import { afterEach, describe, expect, it } from 'vitest';
import type { RigConfig } from '../src/config.js';
import { registerDigestPage } from '../src/digest/page.js';

const tempDirs: string[] = [];

function makeRunsDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-digest-page-'));
  tempDirs.push(dir);
  return dir;
}

function appFor(runsDir: string) {
  const app = new Hono();
  const config: RigConfig = {
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  };
  registerDigestPage(app, config);
  return app;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('digest page', () => {
  it('renders rows by job and marks failures and repeated retries', async () => {
    const runsDir = makeRunsDir();
    writeFileSync(
      join(runsDir, '2026-10-28.jsonl'),
      [
        JSON.stringify({ at: '2026-10-28T08:00:00+02:00', job: 'zeta', status: 'retry', owner: null }),
        JSON.stringify({ at: '2026-10-28T08:01:00+02:00', job: 'zeta', status: 'retry', owner: null }),
        JSON.stringify({ at: '2026-10-28T08:02:00+02:00', job: 'zeta', status: 'retry', owner: null }),
        JSON.stringify({ at: '2026-10-28T08:03:00+02:00', job: 'alpha', status: 'fail', owner: 'ops', error: 'disk full' }),
        '{bad json',
      ].join('\n'),
    );

    const response = await appFor(runsDir).request('/digest/2026-10-28');
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html.indexOf('alpha')).toBeLessThan(html.indexOf('zeta'));
    expect(html).toContain('class="warn"');
    expect(html).toContain('3 or more retries');
    expect(html).toContain('disk full');
    expect(html).toContain('—');
    expect(html).toContain('1 malformed line skipped');
    expect(html).toContain('2026-10-28T08:00:00+02:00');
  });

  it('returns 404 when the night file is missing', async () => {
    const response = await appFor(makeRunsDir()).request('/digest/2026-10-30');
    expect(response.status).toBe(404);
  });

  it('renders an empty night as nothing ran', async () => {
    const runsDir = makeRunsDir();
    writeFileSync(join(runsDir, '2026-10-28.jsonl'), '');

    const response = await appFor(runsDir).request('/digest/2026-10-28');
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('nothing ran');
  });
});
