import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, NightDigest, ReadNight, RunStatus } from './types.js';

type RunEvent = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

function isRunEvent(value: unknown): value is RunEvent {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.at === 'string' &&
    typeof record.job === 'string' &&
    record.job.length > 0 &&
    (record.status === 'ok' || record.status === 'retry' || record.status === 'fail') &&
    (record.owner === null || typeof record.owner === 'string') &&
    (record.error === undefined || typeof record.error === 'string')
  );
}

function missingFile(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

function readContents(runsDir: string, night: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;
  try {
    return readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (error) {
    if (missingFile(error)) return null;
    throw error;
  }
}

export const readNight: ReadNight = (runsDir, night): NightDigest | null => {
  const contents = readContents(runsDir, night);
  if (contents === null) return null;

  const rows = new Map<string, DigestRow>();
  const lines = contents.split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();

  let badLines = 0;
  for (const line of lines) {
    if (line.trim() === '') {
      badLines++;
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      badLines++;
      continue;
    }

    if (!isRunEvent(parsed)) {
      badLines++;
      continue;
    }

    const current = rows.get(parsed.job);
    rows.set(parsed.job, {
      job: parsed.job,
      owner: parsed.owner,
      runs: (current?.runs ?? 0) + 1,
      retries: (current?.retries ?? 0) + Number(parsed.status === 'retry'),
      lastStatus: parsed.status,
      lastError: parsed.error ?? current?.lastError ?? null,
      firstAt: current?.firstAt ?? parsed.at,
      lastAt: parsed.at,
    });
  }

  return { night, rows: [...rows.values()], badLines };
};
