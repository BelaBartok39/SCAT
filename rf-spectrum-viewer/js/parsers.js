/**
 * RF Spectrum Viewer - Parsers
 * 
 * Provides file format parsers for various RF spectrum data files.
 * Supported formats: HackRF sweep, raw I/Q data, SigMF, and generic CSV.
 */

window.Parsers = (function() {
    
    /**
     * Auto-detect format from filename extension and file content.
     * @param {string} filename The name of the file
     * @param {ArrayBuffer} arrayBuffer The file content as an ArrayBuffer
     * @returns {string} The detected format
     */
    function detectFormat(filename, arrayBuffer) {
        const ext = filename.split('.').pop().toLowerCase();
        
        if (ext === 'csv') {
            // Read first chunk as text to check if it's hackrf_sweep
            const uint8Array = new Uint8Array(arrayBuffer, 0, Math.min(1024, arrayBuffer.byteLength));
            const textDecoder = new TextDecoder();
            const text = textDecoder.decode(uint8Array);
            const firstLine = text.split('\n')[0];
            
            // HackRF sweep format starts with date pattern e.g. YYYY-MM-DD
            if (firstLine.match(/^\d{4}-\d{2}-\d{2}/) && firstLine.split(',').length > 6) {
                return 'hackrf_sweep';
            }
            return 'csv_generic';
        }
        
        if (['raw', 'cs8', 'complex16s'].includes(ext)) return 'iq_int8';
        if (['cu8'].includes(ext)) return 'iq_uint8';
        if (['cs16', 'sc16'].includes(ext)) return 'iq_int16';
        if (['cf32', 'fc32'].includes(ext)) return 'iq_float32';
        
        if (ext === 'sigmf-data' || ext === 'sigmf-meta') return 'sigmf';
        
        return 'unknown';
    }
    
    /**
     * Returns true if format requires IQ parameters (sample rate, center freq, FFT size).
     * @param {string} format The format string
     * @returns {boolean} True if IQ parameters are needed
     */
    function needsIQParams(format) {
        return format.startsWith('iq_');
    }
    
    /**
     * Parse HackRF sweep CSV
     * @param {string} textContent The CSV content
     * @returns {Object} Normalized data structure
     */
    function parseHackRFSweep(textContent) {
        const lines = textContent.split('\n').filter(line => line.trim().length > 0);
        
        const timeGroups = new Map();
        const freqSet = new Set();
        
        for (const line of lines) {
            const parts = line.split(',').map(s => s.trim());
            if (parts.length < 7) continue;
            
            const date = parts[0];
            const timeStr = parts[1];
            const timestamp = `${date}T${timeStr}Z`;
            
            const hzLow = parseFloat(parts[2]);
            const hzHigh = parseFloat(parts[3]);
            // bin_width = parseFloat(parts[4])
            // num_samples = parseInt(parts[5], 10)
            
            // Power readings start at index 6
            const powers = parts.slice(6).map(p => parseFloat(p));
            
            if (!timeGroups.has(timestamp)) {
                timeGroups.set(timestamp, new Map());
            }
            
            const freqMap = timeGroups.get(timestamp);
            
            // Calculate center frequency in MHz for each bin and average power
            let avgPower = 0;
            if (powers.length > 0) {
                avgPower = powers.reduce((sum, p) => sum + p, 0) / powers.length;
            }
            
            const centerFreqHz = (hzLow + hzHigh) / 2;
            const centerFreqMHz = centerFreqHz / 1000000;
            
            freqMap.set(centerFreqMHz, avgPower);
            freqSet.add(centerFreqMHz);
        }
        
        const freqs = Array.from(freqSet).sort((a, b) => a - b);
        const timesStr = Array.from(timeGroups.keys()).sort();
        const times = timesStr.map((_, i) => i);
        
        const powers2D = [];
        let pMin = Infinity;
        let pMax = -Infinity;
        
        for (let i = 0; i < timesStr.length; i++) {
            const timestamp = timesStr[i];
            const freqMap = timeGroups.get(timestamp);
            const timePowers = [];
            
            for (const freq of freqs) {
                const power = freqMap.has(freq) ? freqMap.get(freq) : -100; // Default min if missing
                timePowers.push(power);
                if (power < pMin) pMin = power;
                if (power > pMax) pMax = power;
            }
            powers2D.push(timePowers);
        }
        
        return {
            freqs,
            times,
            powers: powers2D,
            pMin: pMin === Infinity ? -100 : pMin,
            pMax: pMax === -Infinity ? 0 : pMax,
            meta: {
                source: 'hackrf_sweep',
                startTime: timesStr.length > 0 ? timesStr[0] : undefined
            }
        };
    }
    
    /**
     * Parse raw IQ files — delegates to window.FFT.processIQBuffer()
     * @param {ArrayBuffer} arrayBuffer The raw I/Q data
     * @param {string} format The IQ format
     * @param {number} sampleRate Sample rate in Hz
     * @param {number} centerFreq Center frequency in Hz
     * @param {number} fftSize FFT size
     * @param {number} maxTimeSlices Maximum number of time slices
     * @returns {Object} Normalized data structure
     */
    function parseIQ(arrayBuffer, format, sampleRate, centerFreq, fftSize, maxTimeSlices) {
        let iqBuffer;
        
        if (format === 'iq_int8') {
            const int8 = new Int8Array(arrayBuffer);
            iqBuffer = new Float64Array(int8.length);
            for (let i = 0; i < int8.length; i++) iqBuffer[i] = int8[i] / 128.0;
        } else if (format === 'iq_uint8') {
            const uint8 = new Uint8Array(arrayBuffer);
            iqBuffer = new Float64Array(uint8.length);
            for (let i = 0; i < uint8.length; i++) iqBuffer[i] = (uint8[i] - 128) / 128.0;
        } else if (format === 'iq_int16') {
            const int16 = new Int16Array(arrayBuffer);
            iqBuffer = new Float64Array(int16.length);
            for (let i = 0; i < int16.length; i++) iqBuffer[i] = int16[i] / 32768.0;
        } else if (format === 'iq_float32') {
            const float32 = new Float32Array(arrayBuffer);
            iqBuffer = new Float64Array(float32.length);
            for (let i = 0; i < float32.length; i++) iqBuffer[i] = float32[i];
        } else {
            throw new Error(`Unsupported IQ format: ${format}`);
        }
        
        if (!window.FFT || !window.FFT.processIQBuffer) {
            throw new Error("window.FFT.processIQBuffer is not available.");
        }
        
        const result = window.FFT.processIQBuffer(iqBuffer, fftSize, sampleRate, centerFreq, maxTimeSlices);
        
        return {
            freqs: result.freqs,
            times: result.times,
            powers: result.powers,
            pMin: result.pMin,
            pMax: result.pMax,
            meta: {
                source: format,
                sampleRate: sampleRate,
                centerFreq: centerFreq
            }
        };
    }
    
    /**
     * Parse SigMF
     * @param {string} metaJSON The SigMF metadata JSON string
     * @param {ArrayBuffer} dataBuffer The SigMF data ArrayBuffer
     * @param {number} fftSize FFT size
     * @param {number} maxTimeSlices Maximum time slices
     * @returns {Object} Normalized data structure
     */
    function parseSigMF(metaJSON, dataBuffer, fftSize, maxTimeSlices) {
        const meta = JSON.parse(metaJSON);
        
        const sampleRate = meta.global && meta.global['core:sample_rate'] ? meta.global['core:sample_rate'] : 1e6;
        const datatype = meta.global && meta.global['core:datatype'] ? meta.global['core:datatype'] : 'cf32_le';
        
        let centerFreq = 0;
        if (meta.captures && meta.captures.length > 0 && meta.captures[0]['core:frequency']) {
            centerFreq = meta.captures[0]['core:frequency'];
        }
        
        let format = 'iq_float32';
        if (datatype.includes('f32')) format = 'iq_float32';
        else if (datatype.includes('i16')) format = 'iq_int16';
        else if (datatype.includes('i8') && !datatype.includes('u8')) format = 'iq_int8';
        else if (datatype.includes('u8')) format = 'iq_uint8';
        
        const parsed = parseIQ(dataBuffer, format, sampleRate, centerFreq, fftSize, maxTimeSlices);
        parsed.meta.source = 'sigmf';
        return parsed;
    }
    
    /**
     * Parse generic CSV
     * @param {string} textContent CSV content
     * @returns {Object} Normalized data structure
     */
    function parseGenericCSV(textContent) {
        const lines = textContent.split('\n').filter(l => l.trim().length > 0);
        if (lines.length === 0) throw new Error("Empty CSV file");
        
        const header = lines[0].toLowerCase().split(',').map(s => s.trim());
        
        let freqIdx = -1, powerIdx = -1, timeIdx = -1;
        
        for (let i = 0; i < header.length; i++) {
            const h = header[i];
            if (h.includes('freq')) freqIdx = i;
            else if (h.includes('power') || h.includes('amplitude') || h.includes('dbm') || h.includes('db')) powerIdx = i;
            else if (h.includes('time') || h.includes('timestamp')) timeIdx = i;
        }
        
        if (freqIdx === -1 || powerIdx === -1) {
            throw new Error("Could not find frequency or power columns in CSV header");
        }
        
        const timeGroups = new Map();
        const freqSet = new Set();
        
        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(',').map(s => s.trim());
            if (parts.length <= Math.max(freqIdx, powerIdx)) continue;
            
            const freqMHz = parseFloat(parts[freqIdx]);
            const power = parseFloat(parts[powerIdx]);
            
            if (isNaN(freqMHz) || isNaN(power)) continue;
            
            const timestamp = timeIdx !== -1 && parts.length > timeIdx ? parts[timeIdx] : "0";
            
            if (!timeGroups.has(timestamp)) {
                timeGroups.set(timestamp, new Map());
            }
            
            timeGroups.get(timestamp).set(freqMHz, power);
            freqSet.add(freqMHz);
        }
        
        const freqs = Array.from(freqSet).sort((a, b) => a - b);
        const timesStr = Array.from(timeGroups.keys()).sort();
        const times = timesStr.map((_, i) => i);
        
        const powers2D = [];
        let pMin = Infinity;
        let pMax = -Infinity;
        
        for (const timestamp of timesStr) {
            const freqMap = timeGroups.get(timestamp);
            const timePowers = [];
            
            for (const freq of freqs) {
                const power = freqMap.has(freq) ? freqMap.get(freq) : -100;
                timePowers.push(power);
                if (power < pMin) pMin = power;
                if (power > pMax) pMax = power;
            }
            powers2D.push(timePowers);
        }
        
        return {
            freqs,
            times,
            powers: powers2D,
            pMin: pMin === Infinity ? -100 : pMin,
            pMax: pMax === -Infinity ? 0 : pMax,
            meta: {
                source: 'csv_generic',
                startTime: timeIdx !== -1 && timesStr.length > 0 ? timesStr[0] : undefined
            }
        };
    }
    
    /**
     * Master parse function
     * @param {FileList|File[]} files Array of files
     * @param {Object} params Parameters for IQ parsing {sampleRate, centerFreq, fftSize, maxTimeSlices}
     * @returns {Promise<Object>} Normalized data structure
     */
    async function parse(files, params = {}) {
        if (!files || files.length === 0) throw new Error("No files provided");
        
        // Convert FileList to array
        const fileArr = Array.from(files);
        
        const readFileAsArrayBuffer = (file) => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.onerror = e => reject(e);
                reader.readAsArrayBuffer(file);
            });
        };
        
        const readFileAsText = (file) => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.onerror = e => reject(e);
                reader.readAsText(file);
            });
        };
        
        // Handle SigMF which requires both meta and data files
        if (fileArr.some(f => f.name.endsWith('.sigmf-meta') || f.name.endsWith('.sigmf-data'))) {
            const metaFile = fileArr.find(f => f.name.endsWith('.sigmf-meta'));
            const dataFile = fileArr.find(f => f.name.endsWith('.sigmf-data'));
            
            if (!metaFile || !dataFile) {
                throw new Error("SigMF format requires both .sigmf-meta and .sigmf-data files");
            }
            
            const metaJSON = await readFileAsText(metaFile);
            const dataBuffer = await readFileAsArrayBuffer(dataFile);
            
            return parseSigMF(metaJSON, dataBuffer, params.fftSize || 1024, params.maxTimeSlices || 500);
        }
        
        // Handle single file formats
        const file = fileArr[0];
        const arrayBuffer = await readFileAsArrayBuffer(file);
        
        const format = detectFormat(file.name, arrayBuffer);
        
        if (format === 'hackrf_sweep') {
            const textContent = await readFileAsText(file);
            return parseHackRFSweep(textContent);
        } else if (format === 'csv_generic') {
            const textContent = await readFileAsText(file);
            return parseGenericCSV(textContent);
        } else if (needsIQParams(format)) {
            if (!params.sampleRate || !params.centerFreq) {
                throw new Error("Sample rate and center frequency are required for raw IQ files");
            }
            return parseIQ(
                arrayBuffer, 
                format, 
                params.sampleRate, 
                params.centerFreq, 
                params.fftSize || 1024, 
                params.maxTimeSlices || 500
            );
        } else {
            throw new Error(`Unsupported or unknown file format for ${file.name}`);
        }
    }
    
    // Public API
    return {
        detectFormat,
        needsIQParams,
        parseHackRFSweep,
        parseIQ,
        parseSigMF,
        parseGenericCSV,
        parse
    };
})();
