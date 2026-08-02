/**
 * Radix-2 Cooley-Tukey FFT — ported from rf-spectrum-viewer/js/fft.js
 * (IIFE → ESM; behavior unchanged). Zero external dependencies.
 */

/** Pre-compute Hanning window coefficients. */
export function hanningWindow(size: number): Float64Array {
  const window = new Float64Array(size);
  for (let n = 0; n < size; n++) {
    window[n] = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (size - 1)));
  }
  return window;
}

/**
 * In-place Cooley-Tukey radix-2 FFT.
 * Length of `real`/`imag` must be a power of 2.
 */
export function fft(real: Float64Array, imag: Float64Array): void {
  const n = real.length;

  // Bit-reversal permutation
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      let temp = real[i]!;
      real[i] = real[j]!;
      real[j] = temp;
      temp = imag[i]!;
      imag[i] = imag[j]!;
      imag[j] = temp;
    }
    let k = n >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  // Decimation-in-time butterflies
  for (let size = 2; size <= n; size <<= 1) {
    const halfSize = size >> 1;
    const angle = (-2 * Math.PI) / size;
    const wReal = Math.cos(angle);
    const wImag = Math.sin(angle);

    for (let i = 0; i < n; i += size) {
      let uReal = 1;
      let uImag = 0;

      for (let k = 0; k < halfSize; k++) {
        const evenIndex = i + k;
        const oddIndex = i + k + halfSize;

        const tempReal = uReal * real[oddIndex]! - uImag * imag[oddIndex]!;
        const tempImag = uReal * imag[oddIndex]! + uImag * real[oddIndex]!;

        real[oddIndex] = real[evenIndex]! - tempReal;
        imag[oddIndex] = imag[evenIndex]! - tempImag;
        real[evenIndex] = real[evenIndex]! + tempReal;
        imag[evenIndex] = imag[evenIndex]! + tempImag;

        const nextUReal = uReal * wReal - uImag * wImag;
        const nextUImag = uReal * wImag + uImag * wReal;
        uReal = nextUReal;
        uImag = nextUImag;
      }
    }
  }
}

/**
 * Power spectral density from interleaved IQ samples, in dBFS,
 * DC shifted to center. `iqSamples` length must be 2*fftSize.
 */
export function computePSD(
  iqSamples: ArrayLike<number>,
  fftSize: number,
  windowCoeffs: Float64Array,
): Float64Array {
  const real = new Float64Array(fftSize);
  const imag = new Float64Array(fftSize);

  for (let i = 0; i < fftSize; i++) {
    real[i] = iqSamples[2 * i]! * windowCoeffs[i]!;
    imag[i] = iqSamples[2 * i + 1]! * windowCoeffs[i]!;
  }

  fft(real, imag);

  const power = new Float64Array(fftSize);
  const halfSize = fftSize >> 1;

  for (let i = 0; i < fftSize; i++) {
    const re = real[i]!;
    const im = imag[i]!;
    let magSq = re * re + im * im;
    if (magSq === 0) magSq = 1e-12;
    const dbfs = 10 * Math.log10(magSq);
    // fftshift: move DC to center
    if (i < halfSize) power[i + halfSize] = dbfs;
    else power[i - halfSize] = dbfs;
  }

  return power;
}

export interface WaterfallData {
  /** Frequency axis in MHz. */
  freqs: number[];
  /** Time of each slice in seconds. */
  times: number[];
  /** One PSD per time slice. */
  powers: Float64Array[];
  pMin: number;
  pMax: number;
}

/** Convert a raw interleaved IQ buffer into waterfall data. */
export function processIQBuffer(
  iqBuffer: ArrayLike<number>,
  fftSize: number,
  sampleRate: number,
  centerFreq: number,
  maxTimeSlices = 100,
): WaterfallData {
  const windowCoeffs = hanningWindow(fftSize);
  const frameSize = 2 * fftSize;
  const totalFrames = Math.floor(iqBuffer.length / frameSize);

  let framesToProcess = totalFrames;
  let step = 1;
  if (totalFrames > maxTimeSlices) {
    step = Math.ceil(totalFrames / maxTimeSlices);
    framesToProcess = Math.ceil(totalFrames / step);
  }

  const powers: Float64Array[] = [];
  const times: number[] = [];
  let pMin = Infinity;
  let pMax = -Infinity;

  const frame = new Float64Array(frameSize);
  for (let i = 0; i < framesToProcess; i++) {
    const frameIndex = i * step;
    if (frameIndex >= totalFrames) break;
    const startIndex = frameIndex * frameSize;
    if (startIndex + frameSize > iqBuffer.length) break;

    for (let k = 0; k < frameSize; k++) frame[k] = iqBuffer[startIndex + k]!;
    const psd = computePSD(frame, fftSize, windowCoeffs);

    powers.push(psd);
    times.push((frameIndex * fftSize) / sampleRate);

    for (let j = 0; j < fftSize; j++) {
      const p = psd[j]!;
      if (p < pMin) pMin = p;
      if (p > pMax) pMax = p;
    }
  }

  const freqs = new Array<number>(fftSize);
  const freqStep = sampleRate / fftSize;
  const startFreq = centerFreq - sampleRate / 2;
  for (let i = 0; i < fftSize; i++) {
    freqs[i] = (startFreq + i * freqStep) / 1e6;
  }

  return { freqs, times, powers, pMin, pMax };
}
