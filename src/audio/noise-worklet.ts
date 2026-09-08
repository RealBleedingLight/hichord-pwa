// This file is loaded as an AudioWorklet module
const PROCESSOR_CODE = `
class NoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.type = 'white';
    this.pinkB = [0, 0, 0, 0, 0, 0, 0];
    this.port.onmessage = (e) => { this.type = e.data.type; };
  }
  process(inputs, outputs) {
    const output = outputs[0];
    for (const channel of output) {
      for (let i = 0; i < channel.length; i++) {
        if (this.type === 'white') {
          channel[i] = Math.random() * 2 - 1;
        } else if (this.type === 'pink') {
          const white = Math.random() * 2 - 1;
          this.pinkB[0] = 0.99886 * this.pinkB[0] + white * 0.0555179;
          this.pinkB[1] = 0.99332 * this.pinkB[1] + white * 0.0750759;
          this.pinkB[2] = 0.96900 * this.pinkB[2] + white * 0.1538520;
          this.pinkB[3] = 0.86650 * this.pinkB[3] + white * 0.3104856;
          this.pinkB[4] = 0.55000 * this.pinkB[4] + white * 0.5329522;
          this.pinkB[5] = -0.7616 * this.pinkB[5] - white * 0.0168980;
          channel[i] = (this.pinkB[0] + this.pinkB[1] + this.pinkB[2] + this.pinkB[3] + this.pinkB[4] + this.pinkB[5] + this.pinkB[6] + white * 0.5362) * 0.11;
          this.pinkB[6] = white * 0.115926;
        } else {
          channel[i] = Math.random() * 2 - 1;
        }
      }
    }
    return true;
  }
}
registerProcessor('noise-processor', NoiseProcessor);
`;

export function getNoiseWorkletUrl(): string {
  const blob = new Blob([PROCESSOR_CODE], { type: 'application/javascript' });
  return URL.createObjectURL(blob);
}
