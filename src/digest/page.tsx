import type { Hono } from 'hono';
import type { RigConfig } from '../config.js';
import { lane } from '../lane.js';
import { Layout } from '../views/layout.js';
import { readNight } from './read.js';
import type { DigestRow, NightDigest } from './types.js';

function needsAttention(row: DigestRow): boolean {
  return row.retries >= 3 || row.lastStatus === 'fail';
}

function DigestPage({ digest }: { digest: NightDigest }) {
  const rows = [...digest.rows].sort((left, right) => left.job.localeCompare(right.job));

  return (
    <>
      <h1>morning digest</h1>
      <p class="mute">night: {digest.night}</p>
      <p class="mute">
        {digest.badLines} malformed {digest.badLines === 1 ? 'line' : 'lines'} skipped
      </p>
      {rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first time</th>
              <th>last time</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr class={needsAttention(row) ? 'warn' : undefined}>
                <td>{row.job}</td>
                <td>{row.owner ?? '—'}</td>
                <td>{row.runs}</td>
                <td>{row.retries}</td>
                <td>
                  {needsAttention(row) ? <strong class="warn">{row.lastStatus}</strong> : row.lastStatus}
                  {row.retries >= 3 ? <span class="warn"> · 3 or more retries</span> : null}
                </td>
                <td>{row.lastError ?? '—'}</td>
                <td>{row.firstAt}</td>
                <td>{row.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

export function registerDigestPage(app: Hono, config: RigConfig): void {
  app.get('/digest/:night', (c) => {
    const digest = readNight(config.runsDir, c.req.param('night'));
    if (!digest) return c.notFound();

    return c.html(
      <Layout title={`digest · ${digest.night}`} lane={lane()}>
        <DigestPage digest={digest} />
      </Layout>,
    );
  });
}
