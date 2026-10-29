import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { registerDigestApi } from '../src/digest/api.js';
import type { RigConfig } from '../src/config.js';
import type { NightDigest } from '../src/digest/types.js';

const config: RigConfig = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir: 'runs',
};

describe('GET /api/digest/:night', () => {
  it('returns the digest rows sorted by job', async () => {
    const app = new Hono();
    registerDigestApi(app, config);

    const response = await app.request('/api/digest/2026-10-28');
    const body = (await response.json()) as NightDigest;

    expect(response.status).toBe(200);
    expect(body.night).toBe('2026-10-28');
    expect(body.badLines).toBe(1);
    expect(body.rows.map((row) => row.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('returns 404 when the night file is missing', async () => {
    const app = new Hono();
    registerDigestApi(app, config);

    const response = await app.request('/api/digest/2026-10-30');

    expect(response.status).toBe(404);
  });
});
