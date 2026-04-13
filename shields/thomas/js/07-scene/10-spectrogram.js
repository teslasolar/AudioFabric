// Spectrogram — scrolling waterfall driven by musicAnalyser (tab audio / local file)
// Acts as both a cool visual and a live indicator that music audio is flowing.

var spectrogramCanvas = null;
var spectrogramCtx = null;
var spectrogramColumn = null; // ImageData for a 1px column
var spectrogramW = 320;
var spectrogramH = 96;

function initSpectrogram() {
  // Create a fixed-position canvas at the bottom center of the screen
  var wrap = document.createElement('div');
  wrap.id = 'spectrogram-wrap';
  wrap.style.cssText = 'position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:60;background:rgba(6,4,14,0.85);border:1px solid rgba(0,200,255,0.25);border-radius:4px;padding:6px 8px 4px;backdrop-filter:blur(8px);display:none;pointer-events:none';
  wrap.innerHTML = '<div style="font-size:8px;color:rgba(0,200,255,0.6);letter-spacing:3px;margin-bottom:4px;font-family:\'JetBrains Mono\',monospace">\u25B8 SPECTROGRAM <span id="spectrogram-source" style="color:rgba(255,248,231,0.3);margin-left:8px"></span></div>';
  spectrogramCanvas = document.createElement('canvas');
  spectrogramCanvas.width = spectrogramW;
  spectrogramCanvas.height = spectrogramH;
  spectrogramCanvas.style.cssText = 'display:block;background:#000;border-radius:2px';
  wrap.appendChild(spectrogramCanvas);
  document.body.appendChild(wrap);

  spectrogramCtx = spectrogramCanvas.getContext('2d');
  spectrogramCtx.fillStyle = '#000';
  spectrogramCtx.fillRect(0, 0, spectrogramW, spectrogramH);
  spectrogramColumn = spectrogramCtx.createImageData(1, spectrogramH);
}

// Convert dB magnitude to RGB using a viridis-like colormap
function spectrogramColor(db) {
  // Normalise dB (-100..0) to 0..1
  var t = Math.max(0, Math.min(1, (db + 100) / 70));
  // Viridis-ish gradient: dark purple → teal → yellow-green
  var r, g, b;
  if (t < 0.25) {
    var s = t / 0.25;
    r = Math.round(68 * (1 - s) + 59 * s);
    g = Math.round(1 * (1 - s) + 82 * s);
    b = Math.round(84 * (1 - s) + 139 * s);
  } else if (t < 0.5) {
    var s = (t - 0.25) / 0.25;
    r = Math.round(59 * (1 - s) + 33 * s);
    g = Math.round(82 * (1 - s) + 144 * s);
    b = Math.round(139 * (1 - s) + 141 * s);
  } else if (t < 0.75) {
    var s = (t - 0.5) / 0.25;
    r = Math.round(33 * (1 - s) + 94 * s);
    g = Math.round(144 * (1 - s) + 201 * s);
    b = Math.round(141 * (1 - s) + 98 * s);
  } else {
    var s = (t - 0.75) / 0.25;
    r = Math.round(94 * (1 - s) + 253 * s);
    g = Math.round(201 * (1 - s) + 231 * s);
    b = Math.round(98 * (1 - s) + 37 * s);
  }
  return [r, g, b];
}

function updateSpectrogram() {
  if (!spectrogramCanvas || !spectrogramCtx || !musicAnalyser || !musicFreqData) return;

  var wrap = document.getElementById('spectrogram-wrap');
  if (!musicMode) {
    if (wrap) wrap.style.display = 'none';
    return;
  }
  if (wrap && wrap.style.display === 'none') wrap.style.display = 'block';

  // Fetch latest FFT
  musicAnalyser.getFloatFrequencyData(musicFreqData);

  // Scroll existing image 1px to the left
  spectrogramCtx.drawImage(spectrogramCanvas, -1, 0);

  // Draw the new rightmost column: y maps low-freq (bottom) to high-freq (top)
  // musicFreqData is in dB, range roughly -100..-20
  var bins = musicFreqData.length;
  var colData = spectrogramColumn.data;
  for (var y = 0; y < spectrogramH; y++) {
    // Log-scale frequency mapping — low frequencies get more vertical space
    var t = (spectrogramH - 1 - y) / (spectrogramH - 1); // 0 at bottom, 1 at top
    var binIdx = Math.floor(Math.pow(t, 2.2) * (bins * 0.6)); // 0..0.6*bins covers audible range
    if (binIdx >= bins) binIdx = bins - 1;
    var db = musicFreqData[binIdx];
    var rgb = spectrogramColor(db);
    var off = y * 4;
    colData[off]     = rgb[0];
    colData[off + 1] = rgb[1];
    colData[off + 2] = rgb[2];
    colData[off + 3] = 255;
  }
  spectrogramCtx.putImageData(spectrogramColumn, spectrogramW - 1, 0);
}

function setSpectrogramSource(label) {
  var el = document.getElementById('spectrogram-source');
  if (el) el.textContent = label || '';
}
