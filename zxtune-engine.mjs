// Worker side. Owns the wasm module and renders on demand.
//
// Chunks go straight to the audio worklet over a MessageChannel, so nothing
// here is on the path between the audio thread and its samples except this
// worker itself. Buffers are transferred, never shared.

import createZXTune from './zxtune.mjs';

const CHUNK = 4096;      // frames per render call

let zxtune;
let heap = 0;
let player = null;
let engine = null;       // port to the audio worklet
let generation = 0;
let ended = false;
let rate = 48000;
let loadEma = 0;
let rendered = 0;

const ready = (async () => {
  zxtune = await createZXTune();
  heap = zxtune._malloc(CHUNK * 4);
})();

function errorText(e) {
  const parts = zxtune.getExceptionMessage ? zxtune.getExceptionMessage(e) : null;
  return parts ? parts[parts.length - 1] : String(e);
}

function withHeap(bytes, fn) {
  const at = zxtune._malloc(bytes.length);
  zxtune.HEAPU8.set(bytes, at);
  try {
    return fn(at, bytes.length);
  } finally {
    zxtune._free(at);
  }
}

function release() {
  if (player) {
    player.delete();
    player = null;
  }
}

function renderOne(wanted) {
  if (!player || ended || wanted !== generation) return;
  const started = performance.now();
  const more = player.render(heap, CHUNK);
  const spent = performance.now() - started;
  loadEma = loadEma ? loadEma * 0.85 + spent * 0.15 : spent;
  // slice copies out of the heap into a buffer we can hand over
  const pcm = zxtune.HEAP16.slice(heap >> 1, (heap >> 1) + CHUNK * 2);
  if (!more) ended = true;
  engine.postMessage({ type: 'pcm', buffer: pcm.buffer, last: !more, generation: wanted }, [pcm.buffer]);
  if (++rendered % 4 === 0) {
    self.postMessage({ type: 'load', ms: loadEma, budgetMs: (CHUNK / rate) * 1000 });
  }
}

self.onmessage = async event => {
  const message = event.data;
  await ready;

  switch (message.type) {
    case 'engine':
      engine = event.ports[0];
      engine.onmessage = e => {
        if (e.data.type === 'need') renderOne(e.data.generation);
      };
      break;

    case 'open': {
      release();
      ended = false;
      generation = message.generation;
      rate = message.sampleRate;
      loadEma = 0;
      try {
        const meta = withHeap(message.bytes, (at, size) => {
          const track = zxtune.load(at, size, message.subpath ?? '');
          const info = {
            type: track.getProperty('Type', ''),
            title: track.getProperty('Title', ''),
            author: track.getProperty('Author', ''),
            program: track.getProperty('Program', ''),
            durationMs: track.getDuration(),
          };
          player = track.createPlayer(message.sampleRate);
          track.delete();
          return info;
        });
        self.postMessage({ type: 'opened', meta, generation });
      } catch (e) {
        self.postMessage({ type: 'failed', reason: errorText(e) });
      }
      break;
    }

    case 'detect':
      try {
        const found = withHeap(message.bytes, (at, size) => {
          const { tracks } = zxtune.detect(at, size);
          return [...Array(tracks.length).keys()].map(i => ({ ...tracks[i] }));
        });
        self.postMessage({ type: 'detected', tracks: found });
      } catch (e) {
        self.postMessage({ type: 'failed', reason: errorText(e) });
      }
      break;

    case 'seek':
      if (player) {
        generation = message.generation;
        ended = false;
        player.seek(message.ms);
      }
      break;

    case 'stop':
      generation = message.generation;
      ended = true;
      release();
      break;
  }
};
