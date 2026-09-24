// Imports a phrase pack into a game in the remote D1 database.
//
//   node scripts/import-phrases.js <pack.json> <GAME_CODE> [--dry-run]
//
// pack.json: { "phrases": { "<phrase key>": ["text", ...], ... } } — keys as in src/texts.js
// (join, draw, wish1..wish7, lastDay, gift1..gift7, reveal, interjections, addresses).
// Keep packs with private content outside the repository.
// Phrases are validated like in the bot, duplicates are skipped, the per-key limit is respected.
// Imported phrases have no author: only the organizer can delete them.

import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_CUSTOM_PHRASES, PHRASES, validatePhrase } from '../src/texts.js';

const [packPath, code, flag] = process.argv.slice(2);
if (!packPath || !code) {
  console.error('Usage: node scripts/import-phrases.js <pack.json> <GAME_CODE> [--dry-run]');
  process.exit(1);
}
const dryRun = flag === '--dry-run';

// Wrangler's JS entry is run with node directly: no shell, so SQL arguments aren't split on spaces.
const WRANGLER = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
const wrangler = (args) => execFileSync(process.execPath, [WRANGLER, ...args], { encoding: 'utf8' });

function loadGame() {
  const out = wrangler(['d1', 'execute', 'santa-bot', '--remote', '--json', '--command', `SELECT data FROM games WHERE code = '${code.replaceAll("'", "''")}'`]);
  const row = JSON.parse(out.slice(out.indexOf('[')))[0].results[0];
  if (!row) throw new Error(`Game ${code} not found`);
  return JSON.parse(row.data);
}

const pack = JSON.parse(readFileSync(packPath, 'utf8')).phrases;
const game = loadGame();
game.phrases ??= {};
const report = [];

for (const [key, texts] of Object.entries(pack)) {
  if (!PHRASES[key]) {
    report.push(`✘ ${key}: unknown key, skipped`);
    continue;
  }
  const list = (game.phrases[key] ??= []);
  let added = 0;
  for (const raw of texts) {
    const text = raw.trim();
    const error = validatePhrase(key, text);
    if (error) report.push(`✘ ${key}: "${text}" — ${error.split('\n')[0]}`);
    else if (list.some((p) => p.text === text)) continue;
    else if (list.length >= MAX_CUSTOM_PHRASES) report.push(`✘ ${key}: limit ${MAX_CUSTOM_PHRASES} reached, "${text}" skipped`);
    else {
      game.nextPhraseId = (game.nextPhraseId ?? 0) + 1;
      list.push({ id: game.nextPhraseId, text, by: 'import' });
      added++;
    }
  }
  report.push(`✔ ${key}: +${added} (total ${list.length})`);
}

console.log(report.join('\n'));
if (dryRun) {
  console.log('\nDry run: nothing written.');
  process.exit(0);
}

// The game document is replaced as a whole; the bot writes it the same way.
const sqlFile = join(tmpdir(), `santa-import-${code}.sql`);
const data = JSON.stringify(game).replaceAll("'", "''");
writeFileSync(sqlFile, `UPDATE games SET data = '${data}', updated_at = '${new Date().toISOString()}' WHERE code = '${code}';\n`);
try {
  wrangler(['d1', 'execute', 'santa-bot', '--remote', '--file', sqlFile, '--yes']);
  console.log(`\nImported into game ${code}.`);
} finally {
  rmSync(sqlFile, { force: true });
}
