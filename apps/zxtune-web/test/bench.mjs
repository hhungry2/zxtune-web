// Realtime headroom check: how much faster than playback does the module render?
//   node apps/zxtune-web/test/bench.mjs <file> [subpath]
import createZXTune from '../../../bin/emscripten/release/zxtune.mjs';
import { openWithSiblings } from './open.mjs';

const RATE = 48000;      // browser default
const CHUNK = 4096;      // samples pulled per callback
const SECONDS = 30;      // upper bound, stops earlier at end of module

const [, , path, subpath = ''] = process.argv;
if (!path) {
  console.error('usage: bench.mjs <file> [subpath]');
  process.exit(2);
}

const zxtune = await createZXTune();

const loadStart = performance.now();
let track;
let resolved = [];
try {
  ({ track, resolved } = openWithSiblings(zxtune, path, subpath));
} catch (e) {
  console.error(`${path}: load failed: ${zxtune.getExceptionMessage?.(e)?.at(-1) ?? e}`);
  process.exit(1);
}
const loadMs = performance.now() - loadStart;
if (resolved.length) {
  console.log(`resolved: ${resolved.join(', ')}`);
}

const player = track.createPlayer(RATE);
const type = track.getProperty('Type', '?');
track.delete();

const buffer = zxtune._malloc(CHUNK * 4);
const times = [];
let played = 0;
for (let i = 0; i < Math.ceil((SECONDS * RATE) / CHUNK); ++i) {
  const start = performance.now();
  const more = player.render(buffer, CHUNK);
  times.push(performance.now() - start);
  played += CHUNK / RATE;
  if (!more) {
    break;   // module is over, the rest would be silence
  }
}
zxtune._free(buffer);
player.delete();

times.sort((lh, rh) => lh - rh);
const total = times.reduce((acc, value) => acc + value, 0);
const budget = (CHUNK / RATE) * 1000;   // ms of audio carried by one chunk
const pick = quantile => times[Math.min(times.length - 1, Math.floor(times.length * quantile))];

console.log(
  [
    `${path.replace(/^.*\/chiptunes\//, '')}${subpath}`.padEnd(44),
    `type=${type.padEnd(4)}`,
    `load=${loadMs.toFixed(1).padStart(6)}ms`,
    `played=${played.toFixed(1).padStart(5)}s`,
    `realtime=${((played * 1000) / total).toFixed(1).padStart(7)}x`,
    `p50=${pick(0.5).toFixed(2).padStart(6)}ms`,
    `p99=${pick(0.99).toFixed(2).padStart(6)}ms`,
    `max=${times.at(-1).toFixed(2).padStart(6)}ms`,
    `budget=${budget.toFixed(1)}ms`,
  ].join('  '),
);
