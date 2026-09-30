import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

// Explicit --apply is required. This runner never selects a project or handles credentials.
if (!process.argv.includes('--apply') || !process.env.SUBSTRATE_SUPABASE_CLI) {
  throw new Error('Set SUBSTRATE_SUPABASE_CLI to an authenticated linked CLI and pass --apply.');
}
const folder = 'data/catalog/brand-import-batches/';
const manifest = JSON.parse(readFileSync(folder + 'manifest.json'));
let completed = [];
try { completed = JSON.parse(readFileSync(folder + 'completed.json')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
for (const batch of manifest) {
  const file = folder + batch.name + '.sql';
  const hash = createHash('sha256').update(readFileSync(file)).digest('hex');
  if (hash !== batch.sha256) throw new Error('Changed generated batch: ' + batch.name);
  const prior = completed.find(b => b.name === batch.name);
  if (prior) { if (prior.sha256 !== hash) throw new Error('Completed batch changed'); continue; }
  const result = spawnSync(process.env.SUBSTRATE_SUPABASE_CLI, ['db','query','--linked','--file',file,'--output','json'], { encoding:'utf8', maxBuffer:2_000_000 });
  if (result.status !== 0) {
    writeFileSync(folder + batch.name + '.error.txt', result.stderr + result.stdout);
    throw new Error('Batch failed: ' + batch.name + '; inspect its local error file.');
  }
  completed.push({ ...batch, completedAt:new Date().toISOString() });
  writeFileSync(folder + 'completed.json', JSON.stringify(completed,null,2) + '\n');
  console.log(`${completed.length}/${manifest.length}: ${batch.name} committed`);
}
