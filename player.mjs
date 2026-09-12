// Main thread wiring. Creates the worker and the audio worklet, hands them a
// MessageChannel to each other, and then stays out of the audio path.

const DEFAULT_BUFFER_SECONDS = 0.4;

export class ZXTunePlayer {
  static async create({ base = '.', bufferSeconds = DEFAULT_BUFFER_SECONDS } = {}) {
    const context = new AudioContext();
    await context.audioWorklet.addModule(`${base}/zxtune-processor.js`);
    return new ZXTunePlayer(context, base, bufferSeconds);
  }

  constructor(context, base, bufferSeconds) {
    this.context = context;
    this.generation = 0;
    this.baseMs = 0;          // position the current generation started from
    this.positionMs = 0;
    this.duration = 0;
    this.onposition = null;
    this.onended = null;
    this.onload = null;       // render cost, reported by the worker

    this.node = new AudioWorkletNode(context, 'zxtune', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      processorOptions: { bufferSeconds },
    });
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = 128;
    this.analyser.smoothingTimeConstant = 0.72;
    this.node.connect(this.analyser);
    this.analyser.connect(context.destination);

    this.worker = new Worker(`${base}/zxtune-engine.mjs`, { type: 'module' });

    const channel = new MessageChannel();
    this.node.port.postMessage({ type: 'engine' }, [channel.port1]);
    this.worker.postMessage({ type: 'engine' }, [channel.port2]);

    this.node.port.onmessage = event => this.onWorklet(event.data);
    this.worker.addEventListener('message', event => {
      if (event.data.type === 'load') this.onload?.(event.data);
    });
  }

  onWorklet(message) {
    if (message.type === 'played') {
      this.positionMs = this.baseMs + (message.frames / this.context.sampleRate) * 1000;
      this.onposition?.(Math.min(this.positionMs, this.duration || this.positionMs));
    } else if (message.type === 'ended') {
      this.onended?.();
    }
  }

  // Waits for one reply of the given type from the worker.
  reply(type) {
    return new Promise((resolve, reject) => {
      const listener = event => {
        const message = event.data;
        if (message.type === type) {
          this.worker.removeEventListener('message', listener);
          resolve(message);
        } else if (message.type === 'failed') {
          this.worker.removeEventListener('message', listener);
          reject(new Error(message.reason));
        }
      };
      this.worker.addEventListener('message', listener);
    });
  }

  // Bumping the generation makes the worklet drop anything rendered before now.
  restart(fromMs) {
    this.baseMs = fromMs;
    this.positionMs = fromMs;
    this.node.port.postMessage({ type: 'reset', generation: ++this.generation });
    return this.generation;
  }

  // Bytes are cloned rather than transferred- the page keeps its copy to replay.
  async detect(bytes) {
    this.worker.postMessage({ type: 'detect', bytes });
    return (await this.reply('detected')).tracks;
  }

  async open(bytes, subpath = '') {
    const generation = this.restart(0);
    this.worker.postMessage({ type: 'open', bytes, subpath, sampleRate: this.context.sampleRate, generation });
    const { meta } = await this.reply('opened');
    this.duration = meta.durationMs;
    return meta;
  }

  seek(ms) {
    const generation = this.restart(ms);
    this.worker.postMessage({ type: 'seek', ms: Math.round(ms), generation });
  }

  play() {
    return this.context.resume();
  }

  pause() {
    return this.context.suspend();
  }

  get playing() {
    return this.context.state === 'running';
  }

  stop() {
    this.worker.postMessage({ type: 'stop', generation: ++this.generation });
    this.node.port.postMessage({ type: 'reset', generation: this.generation });
    this.baseMs = 0;
    this.positionMs = 0;
    this.duration = 0;
  }
}
