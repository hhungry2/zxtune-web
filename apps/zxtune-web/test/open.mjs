// Opens a module and satisfies whatever sibling files it asks for, looking for
// them next to the input. That is how xsf rips are laid out: one small file per
// track plus a shared library holding the actual game audio.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const MAX_ROUNDS = 16;   // resolving can reveal further dependencies

function push(zxtune, bytes, fn) {
  const at = zxtune._malloc(bytes.length);
  zxtune.HEAPU8.set(bytes, at);
  try {
    return fn(at, bytes.length);
  } finally {
    zxtune._free(at);
  }
}

export function openWithSiblings(zxtune, path, subpath = '') {
  const bytes = new Uint8Array(readFileSync(path));
  const track = push(zxtune, bytes, (at, size) => zxtune.load(at, size, subpath));

  const here = dirname(path);
  const resolved = [];
  for (let round = 0; round < MAX_ROUNDS; ++round) {
    const needs = track.getAdditionalFiles();
    const names = [...Array(needs.length).keys()].map(i => needs[i]);
    if (!names.length) break;
    for (const name of names) {
      const extra = new Uint8Array(readFileSync(join(here, name)));
      push(zxtune, extra, (at, size) => track.resolveAdditionalFile(name, at, size));
      resolved.push(`${name} (${(extra.length / 1024).toFixed(0)}KB)`);
    }
  }
  return { track, resolved };
}
