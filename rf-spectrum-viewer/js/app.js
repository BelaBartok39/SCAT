/* ============================================
 *  RF Spectrum 3D Viewer — Application Controller
 *  Main orchestrator: file uploads, format detection,
 *  UI state management, and wiring parsers to renderer.
 * ============================================ */

window.App = (function () {
  'use strict';

  // ——— DOM REFERENCES ———
  const uploadScreen = document.getElementById('upload-screen');
  const vizScreen = document.getElementById('viz-screen');

  // Upload elements
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const fileInfo = document.getElementById('file-info');
  const fileName = document.getElementById('file-name');
  const fileDetail = document.getElementById('file-detail');
  const paramsPanel = document.getElementById('params-panel');
  const paramSR = document.getElementById('param-sr');
  const paramCF = document.getElementById('param-cf');
  const paramFFT = document.getElementById('param-fft');
  const processBtn = document.getElementById('process-btn');
  const progressContainer = document.getElementById('progress-container');
  const progressText = document.getElementById('progress-text');
  const progressPct = document.getElementById('progress-pct');
  const progressFill = document.getElementById('progress-fill');
  const errorMsg = document.getElementById('error-msg');

  // Viz elements
  const vizTitle = document.getElementById('viz-title');
  const vizSub = document.getElementById('viz-sub');
  const statPeakFreq = document.getElementById('stat-peak-freq');
  const statPeakDetail = document.getElementById('stat-peak-detail');
  const statNoise = document.getElementById('stat-noise');
  const statPoints = document.getElementById('stat-points');
  const statDims = document.getElementById('stat-dims');
  const legendMin = document.getElementById('legend-min');
  const legendMid = document.getElementById('legend-mid');
  const legendMax = document.getElementById('legend-max');
  const vizCanvas = document.getElementById('viz-canvas');
  const tooltip = document.getElementById('tooltip');
  const ttFreq = document.getElementById('tt-freq');
  const ttPower = document.getElementById('tt-power');
  const ttBand = document.getElementById('tt-band');
  const btnMode = document.getElementById('btn-mode');
  const btnRotate = document.getElementById('btn-rotate');
  const btnTimeScroll = document.getElementById('btn-timescroll');
  const btnGrid = document.getElementById('btn-grid');
  const btnLabels = document.getElementById('btn-labels');
  const backBtn = document.getElementById('back-btn');

  // Slider elements
  const timeSliderWrap = document.getElementById('time-slider-wrap');
  const timeSlider = document.getElementById('time-slider');
  const timeSliderFill = document.getElementById('time-slider-fill');
  const sliderRangeLabel = document.getElementById('slider-range-label');
  const sliderWindowSize = document.getElementById('slider-window-size');
  const sliderPosition = document.getElementById('slider-position');

  // ——— STATE ———
  let currentFiles = null;
  let detectedFormat = null;
  let renderer = null;
  let fullData = null;
  const SLIDER_WINDOW = 60;

  // Auto time scroll. Advancing the window rebuilds the render grid, which is
  // far more expensive than a redraw, so this is paced in slices per second
  // rather than run once per animation frame.
  const TIMESCROLL_SLICES_PER_SEC = 10;
  let timeScrollOn = false;
  let timeScrollRAF = null;
  let timeScrollLast = 0;
  let timeScrollAccum = 0;

  // ——— HELPERS ———
  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.add('visible');
    setTimeout(() => errorMsg.classList.remove('visible'), 6000);
  }

  function setProgress(pct, text) {
    progressFill.style.width = pct + '%';
    progressPct.textContent = Math.round(pct) + '%';
    if (text) progressText.textContent = text;
  }

  function switchScreen(target) {
    if (target === 'viz') {
      uploadScreen.classList.remove('visible');
      uploadScreen.classList.add('hidden');
      vizScreen.classList.remove('hidden');
      vizScreen.classList.add('visible');
    } else {
      vizScreen.classList.remove('visible');
      vizScreen.classList.add('hidden');
      uploadScreen.classList.remove('hidden');
      uploadScreen.classList.add('visible');
      if (renderer) {
        renderer.stop();
      }
    }
  }

  // ——— FILE HANDLING ———
  function handleFiles(files) {
    if (!files || files.length === 0) return;

    currentFiles = files;
    const file = files[0];

    // Show file info
    fileName.textContent = file.name;
    fileDetail.textContent = `${formatBytes(file.size)} · ${file.type || 'binary'}`;
    fileInfo.classList.add('visible');
    errorMsg.classList.remove('visible');

    // Detect format
    const reader = new FileReader();
    reader.onload = function (e) {
      const buffer = e.target.result;
      detectedFormat = window.Parsers.detectFormat(file.name, buffer);

      if (detectedFormat === 'unknown') {
        showError('Unrecognized file format. Supported: .csv, .raw, .cs8, .cu8, .cs16, .cf32, .sigmf-data');
        paramsPanel.classList.remove('visible');
        return;
      }

      fileDetail.textContent = `${formatBytes(file.size)} · Detected: ${detectedFormat}`;

      if (window.Parsers.needsIQParams(detectedFormat)) {
        paramsPanel.classList.add('visible');
      } else {
        paramsPanel.classList.remove('visible');
        // Auto-process for non-IQ formats
        processFile();
      }
    };
    reader.readAsArrayBuffer(file.slice(0, 4096)); // Read just header for detection
  }

  // ——— PROCESSING ———
  async function processFile() {
    if (!currentFiles || !detectedFormat) return;

    progressContainer.classList.add('visible');
    processBtn.disabled = true;
    setProgress(10, 'Reading file...');

    try {
      const params = {
        sampleRate: parseInt(paramSR.value) || 20000000,
        centerFreq: parseInt(paramCF.value) || 2450000000,
        fftSize: parseInt(paramFFT.value) || 1024,
        maxTimeSlices: 100,
      };

      setProgress(30, 'Parsing data...');

      // Small delay to let UI update
      await new Promise(r => setTimeout(r, 50));

      const data = await window.Parsers.parse(currentFiles, params);

      setProgress(70, 'Building visualization...');
      await new Promise(r => setTimeout(r, 50));

      showVisualization(data);

      setProgress(100, 'Complete!');
      await new Promise(r => setTimeout(r, 300));

    } catch (err) {
      console.error('Processing error:', err);
      showError('Error processing file: ' + (err.message || err));
    } finally {
      progressContainer.classList.remove('visible');
      processBtn.disabled = false;
    }
  }

  // ——— VISUALIZATION ———
  function showVisualization(data) {
    // Update title
    const file = currentFiles[0];
    vizTitle.textContent = '📡 RF Spectrum Analysis';
    vizSub.textContent = `${file.name.toUpperCase()} · ${data.meta ? data.meta.source.toUpperCase() : 'CAPTURE DATA'}`;

    // Compute stats
    const numFreqs = data.freqs.length;
    const numTimes = data.times.length;
    const totalPoints = numFreqs * numTimes;

    // Find peak
    let peakPower = -Infinity, peakFreq = 0;
    let allPowers = [];
    for (let ti = 0; ti < numTimes; ti++) {
      for (let fi = 0; fi < numFreqs; fi++) {
        const p = data.powers[ti][fi];
        allPowers.push(p);
        if (p > peakPower) {
          peakPower = p;
          peakFreq = data.freqs[fi];
        }
      }
    }

    // Estimate noise floor (25th percentile)
    allPowers.sort((a, b) => a - b);
    const noiseFloor = allPowers[Math.floor(allPowers.length * 0.25)];

    // Update HUD stats
    statPeakFreq.textContent = formatFreq(peakFreq);
    statPeakDetail.textContent = `${peakPower.toFixed(1)} dBm`;
    statNoise.textContent = `${noiseFloor.toFixed(1)} dBm`;
    statPoints.textContent = totalPoints.toLocaleString();
    statDims.textContent = `${numFreqs} freq × ${numTimes} time`;

    // Update legend
    legendMin.textContent = data.pMin.toFixed(0);
    legendMid.textContent = ((data.pMin + data.pMax) / 2).toFixed(0);
    legendMax.textContent = data.pMax.toFixed(0);

    // Switch to viz screen
    switchScreen('viz');

    // Create or update renderer
    if (renderer) {
      renderer.stop();
      renderer.destroy();
    }

    renderer = new window.Renderer(vizCanvas, tooltip, ttFreq, ttPower, ttBand);

    // Setup Slider & Data
    fullData = data;
    if (numTimes > SLIDER_WINDOW) {
      timeSliderWrap.classList.add('visible');
      timeSlider.min = 0;
      timeSlider.max = numTimes - SLIDER_WINDOW;
      timeSlider.value = 0;
      sliderWindowSize.textContent = `Window: ${SLIDER_WINDOW} slices`;
      updateSlider(0);
    } else {
      timeSliderWrap.classList.remove('visible');
      renderer.setData(data);
    }
    
    renderer.resize();
    renderer.start();

    // Reset button states
    btnMode.textContent = 'Surface';
    btnMode.classList.add('on');
    btnRotate.classList.add('on');
    btnGrid.classList.add('on');
    btnLabels.classList.add('on');
    setTimeScroll(false);
  }

  function formatFreq(mhz) {
    if (mhz >= 1000) return (mhz / 1000).toFixed(3) + ' GHz';
    return mhz.toFixed(1) + ' MHz';
  }

  function updateSlider(startIndex) {
    if (!fullData || !renderer) return;
    
    startIndex = parseInt(startIndex);
    const endIndex = startIndex + SLIDER_WINDOW;
    
    // Update UI
    const pct = (startIndex / parseInt(timeSlider.max)) * 100;
    timeSliderFill.style.width = `${pct}%`;
    sliderPosition.textContent = `${startIndex} / ${timeSlider.max}`;
    sliderRangeLabel.textContent = `Slices ${startIndex} - ${endIndex}`;
    
    // Slice data
    const slicedData = {
      freqs: fullData.freqs,
      times: fullData.times.slice(startIndex, endIndex),
      powers: fullData.powers.slice(startIndex, endIndex),
      pMin: fullData.pMin,
      pMax: fullData.pMax,
      meta: fullData.meta
    };
    
    renderer.setData(slicedData);
  }

  // ——— CONTROL HANDLERS ———
  function cycleMode() {
    if (!renderer) return;
    const mode = (renderer.getMode() + 1) % 3;
    renderer.setMode(mode);
    const labels = ['Surface', 'Bars', 'Wireframe'];
    btnMode.textContent = labels[mode];
  }

  function toggleRotate() {
    if (!renderer) return;
    const val = !renderer.getAutoRotate();
    renderer.setAutoRotate(val);
    btnRotate.classList.toggle('on', val);
  }

  /**
   * Advance the time window, wrapping back to the start at the end.
   * Time-based rather than per-frame so the speed does not depend on the
   * machine's frame rate.
   * @param {number} now Timestamp supplied by requestAnimationFrame
   */
  function timeScrollStep(now) {
    if (!timeScrollOn) return;

    if (!timeScrollLast) timeScrollLast = now;
    timeScrollAccum += ((now - timeScrollLast) / 1000) * TIMESCROLL_SLICES_PER_SEC;
    timeScrollLast = now;

    if (timeScrollAccum >= 1) {
      const step = Math.floor(timeScrollAccum);
      timeScrollAccum -= step;

      const max = parseInt(timeSlider.max, 10) || 0;
      let next = (parseInt(timeSlider.value, 10) || 0) + step;
      if (next > max) next = 0; // loop
      timeSlider.value = next;
      updateSlider(next);
    }

    timeScrollRAF = requestAnimationFrame(timeScrollStep);
  }

  function setTimeScroll(on) {
    timeScrollOn = on;
    btnTimeScroll.classList.toggle('on', on);

    if (timeScrollRAF) {
      cancelAnimationFrame(timeScrollRAF);
      timeScrollRAF = null;
    }
    if (on) {
      timeScrollLast = 0;
      timeScrollAccum = 0;
      timeScrollRAF = requestAnimationFrame(timeScrollStep);
    }
  }

  function toggleTimeScroll() {
    // Only meaningful when the capture is long enough to have a time window.
    if (!renderer || !timeSliderWrap.classList.contains('visible')) return;
    setTimeScroll(!timeScrollOn);
  }

  function toggleGrid() {
    if (!renderer) return;
    const val = !renderer.getGrid();
    renderer.setGrid(val);
    btnGrid.classList.toggle('on', val);
  }

  function toggleLabels() {
    if (!renderer) return;
    const val = !renderer.getLabels();
    renderer.setLabels(val);
    btnLabels.classList.toggle('on', val);
  }

  // ——— EVENT LISTENERS ———

  // Drop zone click
  dropZone.addEventListener('click', () => fileInput.click());

  // File input change
  fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

  // Drag and drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
  });

  // Prevent default drag on body
  document.body.addEventListener('dragover', (e) => e.preventDefault());
  document.body.addEventListener('drop', (e) => e.preventDefault());

  // Process button
  processBtn.addEventListener('click', processFile);

  // Back button
  backBtn.addEventListener('click', () => {
    setTimeScroll(false);
    switchScreen('upload');
    // Reset upload state
    fileInfo.classList.remove('visible');
    paramsPanel.classList.remove('visible');
    progressContainer.classList.remove('visible');
    errorMsg.classList.remove('visible');
    fileInput.value = '';
    currentFiles = null;
    detectedFormat = null;
    fullData = null;
  });

  // Slider event — touching the slider hands control back to the user,
  // mirroring how dragging the canvas cancels auto-rotate.
  timeSlider.addEventListener('input', (e) => {
    if (timeScrollOn) setTimeScroll(false);
    updateSlider(e.target.value);
  });

  // Window resize
  window.addEventListener('resize', () => {
    if (renderer) renderer.resize();
  });

  // ——— PUBLIC API ———
  return {
    cycleMode,
    toggleRotate,
    toggleTimeScroll,
    toggleGrid,
    toggleLabels,
  };

})();
