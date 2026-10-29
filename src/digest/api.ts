import type { Hono } from 'hono';
import { readNight } from './read.js';
import type { RigConfig } from '../config.js';

export function registerDigestApi(app: Hono, config: RigConfig): void {
  app.get('/api/digest/:night', (c) => {
    const digest = readNight(config.runsDir, c.req.param('night'));
    if (!digest) return c.notFound();

    return c.json({
      ...digest,
      rows: [...digest.rows].sort((a, b) => a.job.localeCompare(b.job)),
    });
  });
}
