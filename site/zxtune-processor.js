// Audio thread side. Holds no wasm: it drains int16 chunks that the worker
// sends over a MessageChannel and writes them into the output.
//
// Talking to the worker directly means main thread jank cannot starve playback,
// and passing plain transferable buffers keeps SharedArrayBuffer - and with it
// the COOP/COEP requirement - out of the picture.

const REPORT_INTERVAL = 0.1;   // seconds of audio between position updates
const CHUNK_FRAMES = 4096;     // what the worker renders per request
const MAX_IN_FLIGHT = 8;

class ZXTuneProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.target = (options.processorOptions?.bufferSeconds ?? 0.4) * sampleRate;
    this.engine = null;
    this.generation = 0;
    this.clear();
    this.port.onmessage = event => this.onControl(event);
  }

  // Everything that a seek or a track change invalidates.
  clear() {
    this.queue = [];
    this.queued = 0;      // frames waiting to be played
    this.played = 0;      // frames written to the output since the last clear
    this.reported = 0;
    this.pending = 0;     // chunks asked for and not yet delivered
    this.ended = false;
    this.finished = false;
  }

  onControl(event) {
    const message = event.data;
    if (message.type === 'engine') {
      this.engine = event.ports[0];
      this.engine.onmessage = e => this.onAudio(e.data);
    } else if (message.type === 'reset') {
      // chunks rendered before this point belong to the old position
      this.generation = message.generation;
      this.clear();
    }
  }

  onAudio(message) {
    if (message.type !== 'pcm') return;
    if (message.generation !== this.generation) return;   // stale, rendered before a seek
    this.pending = Math.max(0, this.pending - 1);
    const data = new Int16Array(message.buffer);
    this.queue.push({ data, offset: 0 });
    this.queued += data.length >> 1;
    if (message.last) this.ended = true;
  }

  pull() {
    if (!this.engine || this.ended) return;
    while (this.queued + this.pending * CHUNK_FRAMES < this.target && this.pending < MAX_IN_FLIGHT) {
      ++this.pending;
      this.engine.postMessage({ type: 'need', generation: this.generation });
    }
  }

  process(inputs, outputs) {
    const out = outputs[0];
    const left = out[0];
    const right = out[1] ?? out[0];
    const frames = left.length;

    let written = 0;
    while (written < frames && this.queue.length) {
      const head = this.queue[0];
      const available = (head.data.length >> 1) - head.offset;
      const take = Math.min(available, frames - written);
      for (let i = 0; i < take; ++i) {
        const at = (head.offset + i) * 2;
        left[written + i] = head.data[at] / 32768;
        right[written + i] = head.data[at + 1] / 32768;
      }
      head.offset += take;
      written += take;
      this.queued -= take;
      if (head.offset * 2 >= head.data.length) this.queue.shift();
    }
    for (let i = written; i < frames; ++i) {
      left[i] = 0;
      right[i] = 0;
    }
    this.played += written;

    this.pull();

    if (this.played - this.reported >= sampleRate * REPORT_INTERVAL) {
      this.reported = this.played;
      this.port.postMessage({ type: 'played', frames: this.played });
    }
    if (this.ended && this.queued === 0 && !this.finished) {
      this.finished = true;
      this.port.postMessage({ type: 'ended', frames: this.played });
    }
    return true;
  }
}

registerProcessor('zxtune', ZXTuneProcessor);
