/* ---- Configuration ---- */
const CONFIG = (() => {
  const apiUrl = (window.CONNECTQ_API_URL || '').replace(/\/+$/, '');
  const wsUrl = apiUrl ? apiUrl.replace(/^http/, 'ws') : `ws://${location.host}`;
  return { API_URL: apiUrl, WS_URL: wsUrl };
})();

/* ---- Connection Status ---- */
function setConnected(connected) {
  document.getElementById('conn-server').classList.toggle('connected', connected);
}

/* ---- Emotion Colors ---- */
// All 48 Hume emotions mapped to visible colors on dark background
function _c(solid) {
  const r = parseInt(solid.slice(1,3),16), g = parseInt(solid.slice(3,5),16), b = parseInt(solid.slice(5,7),16);
  const dark = '#' + [r,g,b].map(c => Math.round(c*0.5).toString(16).padStart(2,'0')).join('');
  return { solid, glow: `rgba(${r},${g},${b},0.4)`, gradient: [solid, dark] };
}

const EMOTION_COLORS = {
  // Joy / positive energy
  joy: _c('#d4a854'), amusement: _c('#d4a854'), excitement: _c('#e8a040'),
  interest: _c('#c0a060'), pride: _c('#d4a854'), triumph: _c('#e8a040'),
  // Love / warmth
  love: _c('#d46a80'), admiration: _c('#d46a80'), adoration: _c('#d46a80'),
  desire: _c('#c05a70'), romance: _c('#d46a80'),
  // Sadness / blue
  sadness: _c('#5a8aba'), disappointment: _c('#5a8aba'), distress: _c('#6a8aaa'),
  nostalgia: _c('#7a9aba'), 'empathic pain': _c('#6a8a9a'),
  // Anger / red
  anger: _c('#e05555'), contempt: _c('#c04545'), disgust: _c('#aa7a40'),
  annoyance: _c('#c06040'),
  // Anxiety / orange
  anxiety: _c('#c07830'), fear: _c('#aa6aaa'), horror: _c('#aa4a7a'),
  awkwardness: _c('#aa9a70'), confusion: _c('#aa9a6a'),
  // Calm / green
  calmness: _c('#5aaa6a'), contentment: _c('#5aaa6a'), relief: _c('#6aba7a'),
  satisfaction: _c('#7aba6a'), serenity: _c('#5aaa8a'),
  // Missing emotions — now all have bright visible colors
  tiredness: _c('#8a7aaa'), boredom: _c('#8a8aaa'), concentration: _c('#6a9aba'),
  contemplation: _c('#7a9aaa'), determination: _c('#ba8a40'), realization: _c('#aa9a5a'),
  surprise: _c('#baa050'), 'surprise (positive)': _c('#baa050'),
  'surprise (negative)': _c('#aa7a6a'), sympathy: _c('#7a9a8a'),
  craving: _c('#ba7a5a'), entrancement: _c('#8a7aba'), envy: _c('#6a9a6a'),
  guilt: _c('#7a7aaa'), pain: _c('#aa5a5a'), shame: _c('#8a6a8a'),
  ecstasy: _c('#daba5a'), aesthetic_appreciation: _c('#9aaa8a'),
  awe: _c('#7a8aba'), embarrassment: _c('#ba7a7a'),
};

const DEFAULT_COLOR = _c('#8a8a9a'); // visible light grey for any unmapped emotion

function getEmotionColor(name) {
  return EMOTION_COLORS[(name || '').toLowerCase()] || DEFAULT_COLOR;
}

/* ---- Rolling Window Smoothing ---- */
// Keep last N readings and weight recent ones higher
const WINDOW_SIZE = 4;
const WINDOW_WEIGHTS = [0.1, 0.15, 0.25, 0.5]; // oldest → newest
const recentReadings = []; // [topEmotions array, ...]

function smoothEmotions(rawEmotions) {
  recentReadings.push(rawEmotions);
  if (recentReadings.length > WINDOW_SIZE) recentReadings.shift();

  const fused = {};
  for (let i = 0; i < recentReadings.length; i++) {
    // Align weight index to the end (newest gets highest weight)
    const wi = WINDOW_WEIGHTS.length - recentReadings.length + i;
    const weight = WINDOW_WEIGHTS[wi];
    for (const e of recentReadings[i]) {
      fused[e.name] = (fused[e.name] || 0) + e.score * weight;
    }
  }

  return Object.entries(fused)
    .map(([name, score]) => ({ name, score: Math.round(score * 10000) / 10000 }))
    .sort((a, b) => b.score - a.score);
}

/* ---- Emotion Timeline ---- */
const TIMELINE_MAX = 40; // data points (40 * 1.5s = 60s)
const timeline = []; // [{ time, emotion, color, score }]

function addTimelinePoint(emotion, score) {
  const ec = getEmotionColor(emotion);
  timeline.push({ time: Date.now(), emotion, color: ec.solid, score });
  if (timeline.length > TIMELINE_MAX) timeline.shift();
  drawTimeline();
}

function drawTimeline() {
  const canvas = document.getElementById('timeline');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  ctx.scale(dpr, dpr);

  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  ctx.clearRect(0, 0, w, h);

  if (timeline.length < 2) return;

  const step = w / (TIMELINE_MAX - 1);
  const off = TIMELINE_MAX - timeline.length;

  // Auto-scale: find min/max scores in visible window and add padding
  const scores = timeline.map(t => t.score);
  const minScore = Math.max(0, Math.min(...scores) - 0.02);
  const maxScore = Math.min(1, Math.max(...scores) + 0.02);
  const range = Math.max(maxScore - minScore, 0.05); // at least 5% range

  function yPos(score) {
    const normalized = (score - minScore) / range;
    return h - (normalized * h * 0.8) - h * 0.1;
  }

  // Draw filled area
  ctx.beginPath();
  ctx.moveTo(off * step, h);
  for (let i = 0; i < timeline.length; i++) {
    const x = (off + i) * step;
    const y = yPos(timeline[i].score);
    if (i === 0) ctx.lineTo(x, y);
    else {
      const px = (off + i - 1) * step;
      const py = yPos(timeline[i - 1].score);
      const cx = (px + x) / 2;
      ctx.bezierCurveTo(cx, py, cx, y, x, y);
    }
  }
  ctx.lineTo((off + timeline.length - 1) * step, h);
  ctx.closePath();

  const latest = timeline[timeline.length - 1];
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, latest.color + '30');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fill();

  // Draw line
  ctx.beginPath();
  for (let i = 0; i < timeline.length; i++) {
    const x = (off + i) * step;
    const y = yPos(timeline[i].score);
    if (i === 0) ctx.moveTo(x, y);
    else {
      const px = (off + i - 1) * step;
      const py = yPos(timeline[i - 1].score);
      const cx = (px + x) / 2;
      ctx.bezierCurveTo(cx, py, cx, y, x, y);
    }
  }
  ctx.strokeStyle = latest.color;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw dots
  for (let i = 0; i < timeline.length; i++) {
    const x = (off + i) * step;
    const y = yPos(timeline[i].score);
    ctx.beginPath();
    ctx.arc(x, y, i === timeline.length - 1 ? 4 : 2, 0, Math.PI * 2);
    ctx.fillStyle = timeline[i].color;
    ctx.fill();
  }

  // Latest dot glow
  const last = timeline.length - 1;
  const lx = (off + last) * step;
  const ly = yPos(timeline[last].score);
  ctx.beginPath();
  ctx.arc(lx, ly, 6, 0, Math.PI * 2);
  ctx.fillStyle = timeline[last].color + '40';
  ctx.fill();
}

window.addEventListener('resize', drawTimeline);

/* ---- Orb + UI Update ---- */
let prevEmotion = '';

function updateEmotion(emotion, topEmotions) {
  // Apply smoothing
  const smoothed = smoothEmotions(topEmotions);
  const top = smoothed[0];
  const displayEmotion = top.name;
  const ec = getEmotionColor(displayEmotion);
  const root = document.documentElement;

  // Update CSS variables
  root.style.setProperty('--emotion-color', ec.solid);
  root.style.setProperty('--emotion-glow', ec.glow);

  // Update orb
  const orb = document.getElementById('orb');
  orb.style.background = `radial-gradient(circle at 38% 38%, ${ec.gradient[0]}, ${ec.gradient[1]})`;
  orb.style.boxShadow = `0 0 50px ${ec.glow}`;

  // Update glow
  document.getElementById('orb-glow').style.background = ec.solid;

  // Emotion label with crossfade
  const labelEl = document.getElementById('emotion-label');
  if (displayEmotion !== prevEmotion) {
    labelEl.classList.add('changing');
    setTimeout(() => {
      labelEl.textContent = displayEmotion;
      labelEl.style.color = ec.solid;
      setTimeout(() => labelEl.classList.remove('changing'), 250);
    }, 200);
    prevEmotion = displayEmotion;
  }

  // Subtitle
  const subEl = document.getElementById('emotion-sub');
  const pct = Math.round(top.score * 100);
  subEl.textContent = `${pct}% confidence`;
  subEl.style.color = ec.solid;

  // Bars (show smoothed top 3)
  const barsContainer = document.getElementById('emotion-bars');
  barsContainer.classList.add('visible');

  const top3 = smoothed.slice(0, 3);
  for (let i = 0; i < 3; i++) {
    const e = top3[i];
    if (e && e.score > 0.005) {
      const p = Math.round(e.score * 100);
      const barEc = getEmotionColor(e.name);
      document.getElementById(`bar-name-${i}`).textContent = e.name;
      document.getElementById(`bar-fill-${i}`).style.width = p + '%';
      document.getElementById(`bar-fill-${i}`).style.background = barEc.solid;
      document.getElementById(`bar-pct-${i}`).textContent = p + '%';
    } else {
      document.getElementById(`bar-name-${i}`).textContent = '--';
      document.getElementById(`bar-fill-${i}`).style.width = '0%';
      document.getElementById(`bar-pct-${i}`).textContent = '0%';
    }
  }

  // Timeline
  addTimelinePoint(displayEmotion, top.score);

  // Highlight active triggers
  highlightTriggers(smoothed);
}

function showStatus(text) {
  document.getElementById('emotion-label').textContent = text;
  document.getElementById('emotion-label').style.color = '';
  document.getElementById('emotion-sub').textContent = '';
  document.getElementById('emotion-sub').style.color = '';
}

/* ---- Always-On Voice Streaming ---- */
let audioStream = null;
let mediaRecorder = null;
let voiceWs = null;
let isStreaming = false;

const CHUNK_DURATION = 1500;
const RECONNECT_DELAY = 3000;

async function startStreaming() {
  if (isStreaming) return;

  if (!audioStream) {
    try {
      audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      showStatus('Mic access denied');
      setTimeout(startStreaming, RECONNECT_DELAY);
      return;
    }
  }

  voiceWs = new WebSocket(CONFIG.WS_URL + '/ws/voice');

  voiceWs.onopen = () => {
    setConnected(true);
    isStreaming = true;
    showStatus('Listening...');
    startChunkedRecording();
  };

  voiceWs.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'emotion') {
      updateEmotion(data.emotion, data.top_emotions);
    } else if (data.type === 'trigger') {
      showTrigger(data.emotion, data.category, data.microseconds);
    } else if (data.type === 'error') {
      showStatus(data.message || 'Error');
    }
  };

  voiceWs.onclose = () => {
    isStreaming = false;
    setConnected(false);
    showStatus('Reconnecting...');
    setTimeout(startStreaming, RECONNECT_DELAY);
  };

  voiceWs.onerror = () => {};
}

function startChunkedRecording() {
  function recordChunk() {
    if (!isStreaming || !audioStream) return;

    mediaRecorder = new MediaRecorder(audioStream, {
      mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm'
    });

    const chunks = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      if (chunks.length === 0 || !voiceWs || voiceWs.readyState !== WebSocket.OPEN) return;

      const blob = new Blob(chunks, { type: mediaRecorder.mimeType });
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1];
        if (voiceWs && voiceWs.readyState === WebSocket.OPEN) {
          voiceWs.send(JSON.stringify({ type: 'audio', data: base64 }));
        }
      };
      reader.readAsDataURL(blob);

      if (isStreaming) recordChunk();
    };

    mediaRecorder.start();
    setTimeout(() => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    }, CHUNK_DURATION);
  }

  recordChunk();
}

/* ---- Hug Trigger Visual ---- */
const TRIGGER_LABELS = {
  comfort: 'Comfort Hug',
  soothe: 'Gentle Hug',
  celebrate: 'Celebrate!',
};

function showTrigger(emotion, category, microseconds) {
  const ec = getEmotionColor(emotion);
  const label = TRIGGER_LABELS[category] || 'Hug';

  // Flash the orb
  const orb = document.getElementById('orb');
  orb.classList.add('trigger-flash');
  setTimeout(() => orb.classList.remove('trigger-flash'), 1500);

  // Show trigger banner
  const banner = document.getElementById('trigger-banner');
  if (banner) {
    banner.textContent = label;
    banner.style.color = ec.solid;
    banner.style.borderColor = ec.solid + '40';
    banner.style.background = ec.solid + '15';
    banner.classList.add('visible');
    setTimeout(() => banner.classList.remove('visible'), 3000);
  }

  // Update subtitle
  const sub = document.getElementById('emotion-sub');
  sub.textContent = `${label} — ${emotion}`;
  sub.style.color = ec.solid;

  // Flash trigger item in panel
  flashTriggerItem(emotion);
}

/* ---- Trigger Panel ---- */
let triggerConfig = null;

async function loadTriggerPanel() {
  try {
    const res = await fetch(CONFIG.API_URL + '/api/triggers');
    triggerConfig = await res.json();
  } catch {
    return;
  }

  const grid = document.getElementById('trigger-grid');
  if (!grid) return;

  // Group by category
  const groups = { comfort: [], soothe: [], celebrate: [] };
  for (const [emotion, cfg] of Object.entries(triggerConfig)) {
    groups[cfg.category].push({ emotion, ...cfg });
  }

  const labels = {
    comfort: 'Comfort Hug',
    soothe: 'Gentle Hug',
    celebrate: 'Celebrate',
  };

  let html = '';
  for (const [cat, items] of Object.entries(groups)) {
    if (items.length === 0) continue;
    html += `<div class="trigger-cat-label ${cat}">${labels[cat]}</div>`;
    for (const item of items) {
      const pct = Math.round(item.threshold * 100);
      html += `<div class="trigger-item" id="trig-${item.emotion.replace(/\s+/g, '-')}">`
            + `${item.emotion}<span class="thresh">${pct}%</span></div>`;
    }
  }
  grid.innerHTML = html;
}

function highlightTriggers(topEmotions) {
  if (!triggerConfig) return;

  // Build a score map from top emotions
  const scores = {};
  for (const e of topEmotions) {
    scores[e.name] = e.score;
  }

  for (const [emotion, cfg] of Object.entries(triggerConfig)) {
    const el = document.getElementById('trig-' + emotion.replace(/\s+/g, '-'));
    if (!el) continue;
    const score = scores[emotion] || 0;
    el.classList.toggle('active', score >= cfg.threshold);
  }
}

function flashTriggerItem(emotion) {
  const el = document.getElementById('trig-' + emotion.replace(/\s+/g, '-'));
  if (!el) return;
  el.classList.remove('fired');
  void el.offsetWidth;
  el.classList.add('fired');
}

/* ---- Auto-Start ---- */
loadTriggerPanel();
startStreaming();
