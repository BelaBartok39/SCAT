/**
 * FFT Engine for RF Spectrum Viewer
 * Pure JavaScript implementation of Radix-2 Cooley-Tukey FFT.
 * Zero external dependencies.
 */

window.FFT = (function() {
    /**
     * Pre-compute Hanning window coefficients.
     * @param {number} size - The size of the window.
     * @returns {Float64Array} The Hanning window coefficients.
     */
    function hanningWindow(size) {
        const window = new Float64Array(size);
        for (let n = 0; n < size; n++) {
            window[n] = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (size - 1)));
        }
        return window;
    }

    /**
     * In-place Cooley-Tukey radix-2 FFT.
     * @param {Float64Array} real - Real part of the input/output array. Length must be a power of 2.
     * @param {Float64Array} imag - Imaginary part of the input/output array. Length must be a power of 2.
     */
    function fft(real, imag) {
        const n = real.length;
        
        // Bit-reversal permutation
        let j = 0;
        for (let i = 0; i < n - 1; i++) {
            if (i < j) {
                // Swap real[i] and real[j]
                let temp = real[i];
                real[i] = real[j];
                real[j] = temp;
                // Swap imag[i] and imag[j]
                temp = imag[i];
                imag[i] = imag[j];
                imag[j] = temp;
            }
            let k = n >> 1;
            while (k <= j) {
                j -= k;
                k >>= 1;
            }
            j += k;
        }

        // Cooley-Tukey decimation-in-time radix-2 FFT
        for (let size = 2; size <= n; size <<= 1) {
            const halfSize = size >> 1;
            const angle = -2 * Math.PI / size;
            const wReal = Math.cos(angle);
            const wImag = Math.sin(angle);

            for (let i = 0; i < n; i += size) {
                let uReal = 1;
                let uImag = 0;

                for (let k = 0; k < halfSize; k++) {
                    const evenIndex = i + k;
                    const oddIndex = i + k + halfSize;

                    // Multiply odd by twiddle factor
                    const tempReal = uReal * real[oddIndex] - uImag * imag[oddIndex];
                    const tempImag = uReal * imag[oddIndex] + uImag * real[oddIndex];

                    // Butterfly operation
                    real[oddIndex] = real[evenIndex] - tempReal;
                    imag[oddIndex] = imag[evenIndex] - tempImag;
                    real[evenIndex] += tempReal;
                    imag[evenIndex] += tempImag;

                    // Update twiddle factor
                    const nextUReal = uReal * wReal - uImag * wImag;
                    const nextUImag = uReal * wImag + uImag * wReal;
                    uReal = nextUReal;
                    uImag = nextUImag;
                }
            }
        }
    }

    /**
     * Compute power spectral density from IQ samples.
     * @param {Float64Array} iqSamples - Interleaved [I,Q,I,Q,...] array (length = 2*fftSize).
     * @param {number} fftSize - FFT window size, must be a power of 2.
     * @param {Float64Array} windowCoeffs - Coefficients from hanningWindow().
     * @returns {Float64Array} Power values in dBFS (fftSize length), DC shifted to center.
     */
    function computePSD(iqSamples, fftSize, windowCoeffs) {
        const real = new Float64Array(fftSize);
        const imag = new Float64Array(fftSize);

        // De-interleave and apply window
        for (let i = 0; i < fftSize; i++) {
            real[i] = iqSamples[2 * i] * windowCoeffs[i];
            imag[i] = iqSamples[2 * i + 1] * windowCoeffs[i];
        }

        // Perform FFT
        fft(real, imag);

        const power = new Float64Array(fftSize);
        const halfSize = fftSize >> 1;

        // Compute magnitude squared in dB, and apply fftshift
        for (let i = 0; i < fftSize; i++) {
            const re = real[i];
            const im = imag[i];
            // Compute magnitude squared
            let magSq = re * re + im * im;
            
            // Avoid log of zero
            if (magSq === 0) {
                magSq = 1e-12;
            }

            const dbfs = 10 * Math.log10(magSq);

            // fftshift: move DC to center
            if (i < halfSize) {
                power[i + halfSize] = dbfs;
            } else {
                power[i - halfSize] = dbfs;
            }
        }

        return power;
    }

    /**
     * Convert raw IQ buffer to frequency-domain waterfall data.
     * @param {Float64Array} iqBuffer - Interleaved I/Q samples.
     * @param {number} fftSize - FFT window size.
     * @param {number} sampleRate - Sampling rate in Hz.
     * @param {number} centerFreq - Center frequency in Hz.
     * @param {number} [maxTimeSlices=100] - Cap on the number of time slices.
     * @returns {Object} Object containing frequencies, time slices, and power arrays.
     */
    function processIQBuffer(iqBuffer, fftSize, sampleRate, centerFreq, maxTimeSlices = 100) {
        const windowCoeffs = hanningWindow(fftSize);
        const frameSize = 2 * fftSize;
        const totalFrames = Math.floor(iqBuffer.length / frameSize);

        let framesToProcess = totalFrames;
        let step = 1;

        if (totalFrames > maxTimeSlices) {
            step = Math.ceil(totalFrames / maxTimeSlices);
            framesToProcess = Math.ceil(totalFrames / step);
        }

        const powers = [];
        const times = [];
        let pMin = Infinity;
        let pMax = -Infinity;

        for (let i = 0; i < framesToProcess; i++) {
            const frameIndex = i * step;
            if (frameIndex >= totalFrames) break;

            const startIndex = frameIndex * frameSize;
            const endIndex = startIndex + frameSize;
            
            // Should always be full frame
            if (endIndex > iqBuffer.length) break;

            const iqSlice = iqBuffer.slice(startIndex, endIndex);
            const psd = computePSD(iqSlice, fftSize, windowCoeffs);
            
            powers.push(psd);
            times.push(frameIndex * fftSize / sampleRate);

            for (let j = 0; j < fftSize; j++) {
                if (psd[j] < pMin) pMin = psd[j];
                if (psd[j] > pMax) pMax = psd[j];
            }
        }

        // Build frequency axis (in MHz)
        const freqs = new Array(fftSize);
        const freqStep = sampleRate / fftSize;
        const startFreq = centerFreq - sampleRate / 2;
        for (let i = 0; i < fftSize; i++) {
            freqs[i] = (startFreq + i * freqStep) / 1e6;
        }

        return {
            freqs,
            times,
            powers,
            pMin,
            pMax
        };
    }

    return {
        hanningWindow,
        fft,
        computePSD,
        processIQBuffer
    };
})();
