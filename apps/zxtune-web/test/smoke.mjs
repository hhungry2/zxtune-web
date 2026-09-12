// Headless check: load a module, render a second of audio, report what came out.
//   node apps/zxtune-web/test/smoke.mjs <file> [subpath]
import { readFileSync } from 'node:fs';
import createZXTune from '../../../bin/emscripten/release/zxtune.mjs';

const [, , path, subpath = ''] = process.argv;
if (!path) {
  console.error('usage: smoke.mjs <file> [subpath]');
  process.exit(2);
}

const zxtune = await createZXTune();
const bytes = new Uint8Array(readFileSync(path));

const data = zxtune._malloc(bytes.length);
zxtune.HEAPU8.set(bytes, data);
let track;
try {
  track = zxtune.load(data, bytes.length, subpath);
} catch (e) {
  console.error('load failed:', zxtune.getExceptionMessage?.(e) ?? e);
  process.exit(1);
} finally {
  zxtune._free(data);
}

const props = ['Type', 'Title', 'Author', 'Program']
  .map(name => `${name}=${JSON.stringify(track.getProperty(name, ''))}`)
  .join(' ');
console.log(`${path} ${props} duration=${track.getDuration()}ms`);

const RATE = 44100;
const player = track.createPlayer(RATE);
track.delete();

const buffer = zxtune._malloc(RATE * 4);
const more = player.render(buffer, RATE);
const pcm = zxtune.HEAP16.subarray(buffer >> 1, (buffer >> 1) + RATE * 2);

let peak = 0;
let nonzero = 0;
for (const sample of pcm) {
  const value = Math.abs(sample);
  if (value > peak) peak = value;
  if (value !== 0) ++nonzero;
}
console.log(`rendered 1s: peak=${peak} nonzero=${nonzero}/${RATE * 2} more=${more} position=${player.getPosition()}ms`);

zxtune._free(buffer);
player.delete();

if (peak === 0) {
  console.error('silence rendered');
  process.exit(1);
}
