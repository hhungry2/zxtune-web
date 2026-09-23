// Check real renderer state, without advancing it merely by reading it.
// node apps/zxtune-web/test/state.mjs <tracker.pt3> <non-tracker.sid>
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import createZXTune from '../../../bin/emscripten/release/zxtune.mjs';

const [, , trackerPath, nonTrackerPath] = process.argv;
if (!trackerPath || !nonTrackerPath) {
  console.error('usage: state.mjs <tracker.pt3> <non-tracker.sid>');
  process.exit(2);
}
const zxtune = await createZXTune();
function open(path) {
  const bytes = readFileSync(path);
  const at = zxtune._malloc(bytes.length);
  let track;
  try {
    zxtune.HEAPU8.set(bytes, at);
    track = zxtune.load(at, bytes.length, '');
    return track.createPlayer(48000);
  } finally {
    track?.delete();
    zxtune._free(at);
  }
}
const player = open(trackerPath);
const buffer = zxtune._malloc(960 * 4);
try {
  const initial = player.state();
  assert.notEqual(initial, null);
  for (const key of ['position', 'pattern', 'line', 'tempo', 'channels', 'quirk', 'timeMs']) {
    assert.ok(Number.isInteger(initial[key]) && initial[key] >= 0, key);
  }
  assert.deepEqual(player.state(), initial, 'reading must not advance state');
  assert.notEqual(player.state(), initial, 'snapshots must be independent objects');
  const rows = new Set();
  for (let i = 0; i < 250; ++i) {
    player.render(buffer, 960);
    const state = player.state();
    assert.equal(state.timeMs, player.getPosition());
    rows.add(`${state.position}:${state.pattern}:${state.line}`);
  }
  assert.ok(rows.size > 1, 'tracker rows must advance');
  assert.equal(initial.timeMs, 0, 'old snapshots must remain unchanged');
  player.seek(0);
  assert.deepEqual(player.state(), initial, 'seek to start must reset tracker state');
} finally {
  player.delete();
  zxtune._free(buffer);
}
const nonTracker = open(nonTrackerPath);
try {
  assert.equal(nonTracker.state(), null, 'non-tracker must report unavailable state');
} finally {
  nonTracker.delete();
}
console.log('state: all checks passed');
