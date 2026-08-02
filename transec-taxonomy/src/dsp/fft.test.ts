import { describe, it, expect } from 'vitest';
import { hanningWindow, computePSD } from './fft';

describe('computePSD', () => {
  it('peaks in the correct bin for a pure tone', () => {
    const fftSize = 256;
    // Complex exponential at bin +32 (of fs): e^{j 2π (32/256) n}
    const iq = new Float64Array(2 * fftSize);
    for (let n = 0; n < fftSize; n++) {
      const phase = (2 * Math.PI * 32 * n) / fftSize;
      iq[2 * n] = Math.cos(phase);
      iq[2 * n + 1] = Math.sin(phase);
    }
    const psd = computePSD(iq, fftSize, hanningWindow(fftSize));
    let maxIdx = 0;
    for (let i = 1; i < fftSize; i++) if (psd[i]! > psd[maxIdx]!) maxIdx = i;
    // fftshift puts DC at fftSize/2; +32 cycles/frame lands at center+32.
    expect(maxIdx).toBe(fftSize / 2 + 32);
  });

  it('is symmetric-flat for white input dimensions', () => {
    const fftSize = 128;
    const iq = new Float64Array(2 * fftSize).fill(0);
    iq[0] = 1; // impulse → flat spectrum
    const psd = computePSD(iq, fftSize, new Float64Array(fftSize).fill(1));
    const first = psd[0]!;
    for (let i = 1; i < fftSize; i++) expect(psd[i]!).toBeCloseTo(first, 6);
  });
});
