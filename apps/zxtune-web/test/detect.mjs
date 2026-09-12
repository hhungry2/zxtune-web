// Lists every module inside a file, the way a playlist would.
//   node apps/zxtune-web/test/detect.mjs <file>
import { readFileSync } from 'node:fs';
import createZXTune from '../../../bin/emscripten/release/zxtune.mjs';

const [, , path] = process.argv;
if (!path) {
  console.error('usage: detect.mjs <file>');
  process.exit(2);
}

const zxtune = await createZXTune();
const bytes = new Uint8Array(readFileSync(path));

const data = zxtune._malloc(bytes.length);
zxtune.HEAPU8.set(bytes, data);
let found;
try {
  found = zxtune.detect(data, bytes.length);
} finally {
  zxtune._free(data);
}

const { tracks, pictures } = found;
console.log(`${path}: ${tracks.length} track(s), ${pictures.length} picture(s)`);
for (const track of tracks) {
  const label = [track.title, track.author, track.program].filter(Boolean).join(' / ') || '(untitled)';
  console.log(`  ${(track.subpath || '(root)').padEnd(12)} ${track.type.padEnd(5)} ${String(track.durationMs).padStart(7)}ms  ${label}`);
}
for (const picture of pictures) {
  console.log(`  ${picture.subpath}  picture, ${picture.data.length} bytes`);
}

if (tracks.length === 0) {
  console.error('nothing detected');
  process.exit(1);
}
