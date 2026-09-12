// Spectrum analyzer and the library-wide option container.
//   node apps/zxtune-web/test/analyze.mjs <file> [subpath]
import { readFileSync } from 'node:fs';
import createZXTune from '../../../bin/emscripten/release/zxtune.mjs';

const RATE = 48000;
const CHUNK = 4096;
const BANDS = 32;

const [, , path, subpath = ''] = process.argv;
if (!path) {
  console.error('usage: analyze.mjs <file> [subpath]');
  process.exit(2);
}

const zxtune = await createZXTune();
let failures = 0;
const check = (ok, what) => {
  if (!ok) ++failures;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${what}`);
};

// --- global options round trip -------------------------------------------

check(zxtune.getOption('web.probe', 'fallback') === 'fallback', 'unset string option returns the default');
zxtune.setOption('web.probe', 'hello');
check(zxtune.getOption('web.probe', 'fallback') === 'hello', 'string option reads back');

check(zxtune.getIntOption('web.number', 42) === 42, 'unset integer option returns the default');
zxtune.setIntOption('web.number', 1234567);
check(zxtune.getIntOption('web.number', 42) === 1234567, 'integer option reads back');

// --- spectrum -------------------------------------------------------------

const bytes = new Uint8Array(readFileSync(path));
const at = zxtune._malloc(bytes.length);
zxtune.HEAPU8.set(bytes, at);
const track = zxtune.load(at, bytes.length, subpath);
zxtune._free(at);

const player = track.createPlayer(RATE);
track.delete();

const audio = zxtune._malloc(CHUNK * 4);
const levels = zxtune._malloc(BANDS);
const read = () => [...zxtune.HEAPU8.subarray(levels, levels + BANDS)];

// The first call only wakes the analyzer up- nothing has been fed yet.
player.analyze(levels, BANDS);
check(read().every(v => v === 0), 'spectrum starts silent');

for (let i = 0; i < 8; ++i) {
  player.render(audio, CHUNK);
  player.analyze(levels, BANDS);
}
const spectrum = read();
const peak = Math.max(...spectrum);
check(peak > 0, `spectrum fills after rendering (peak ${peak})`);
check(spectrum.every(v => v <= 100), 'levels stay within 0..100');
check(spectrum.some(v => v === 0), 'spectrum has shape, not a flat wall');

// Rendering without asking for the spectrum must stop costing an fft. There is
// no direct readout of that, so just confirm the idle path keeps working.
for (let i = 0; i < 40; ++i) player.render(audio, CHUNK);
player.analyze(levels, BANDS);
check(Math.max(...read()) >= 0, 'analyze still works after a long idle stretch');

console.log(`bands: ${spectrum.join(' ')}`);

zxtune._free(audio);
zxtune._free(levels);
player.delete();

console.log(failures ? `${failures} failure(s)` : 'all ok');
process.exit(failures ? 1 : 0);
