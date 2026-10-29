import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

const tempDirs: string[] = [];

function makeRunsDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('readNight', () => {
  it('aggregates the checked-in fixture and counts its malformed line', () => {
    const digest = readNight('runs', '2026-10-28');

    expect(digest).not.toBeNull();
    expect(digest?.badLines).toBe(1);
    expect(digest?.rows).toHaveLength(5);
    expect(digest?.rows.find((row) => row.job === 'lane/sync')).toEqual({
      job: 'lane/sync',
      owner: 'rook',
      runs: 8,
      retries: 1,
      lastStatus: 'ok',
      lastError: 'lock held',
      firstAt: '2026-10-28T23:00:06+01:00',
      lastAt: '2026-10-29T05:00:04+01:00',
    });
    expect(digest?.rows.find((row) => row.job === 'digest/render')?.owner).toBeNull();
    expect(digest?.rows.find((row) => row.job === 'digest/render')?.firstAt).toBe(
      '2026-10-29T05:41:09+01:00',
    );
  });

  it('counts malformed JSON and invalid records without throwing', () => {
    const dir = makeRunsDir();
    writeFileSync(
      join(dir, '2026-10-29.jsonl'),
      [
        '{bad json',
        JSON.stringify({ at: '2026-10-29T09:00:00+02:00', job: 'job/a', status: 'ok', owner: null }),
        JSON.stringify({ at: '2026-10-29T09:01:00+02:00', job: 'job/a', status: 'invalid', owner: 'ops' }),
        '',
      ].join('\n'),
    );

    expect(readNight(dir, '2026-10-29')).toEqual({
      night: '2026-10-29',
      rows: [
        {
          job: 'job/a',
          owner: null,
          runs: 1,
          retries: 0,
          lastStatus: 'ok',
          lastError: null,
          firstAt: '2026-10-29T09:00:00+02:00',
          lastAt: '2026-10-29T09:00:00+02:00',
        },
      ],
      badLines: 2,
    });
  });

  it('returns an empty digest for an empty file and null for a missing night', () => {
    const dir = makeRunsDir();
    writeFileSync(join(dir, '2026-10-29.jsonl'), '');

    expect(readNight(dir, '2026-10-29')).toEqual({ night: '2026-10-29', rows: [], badLines: 0 });
    expect(readNight(dir, '2026-10-30')).toBeNull();
  });

  it('rejects a night value that could escape the runs directory', () => {
    expect(readNight('runs', '../2026-10-28')).toBeNull();
  });
});
