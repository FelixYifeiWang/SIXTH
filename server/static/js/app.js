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
const EMOTION_COLORS = {
  joy:            { solid: '#d4a854', glow: 'rgba(212,168,84,0.4)',  gradient: ['#d4a854', '#8a6a30'] },
  amusement:      { solid: '#d4a854', glow: 'rgba(212,168,84,0.4)',  gradient: ['#d4a854', '#8a6a30'] },
  excitement:     { solid: '#e8a040', glow: 'rgba(232,160,64,0.4)',  gradient: ['#e8a040', '#9a6820'] },
  interest:       { solid: '#c0a060', glow: 'rgba(192,160,96,0.4)',  gradient: ['#c0a060', '#7a6430'] },
  pride:          { solid: '#d4a854', glow: 'rgba(212,168,84,0.4)',  gradient: ['#d4a854', '#8a6a30'] },
  triumph:        { solid: '#e8a040', glow: 'rgba(232,160,64,0.4)',  gradient: ['#e8a040', '#9a6820'] },
  love:           { solid: '#d46a80', glow: 'rgba(212,106,128,0.4)', gradient: ['#d46a80', '#8a3a4a'] },
  admiration:     { solid: '#d46a80', glow: 'rgba(212,106,128,0.4)', gradient: ['#d46a80', '#8a3a4a'] },
  adoration:      { solid: '#d46a80', glow: 'rgba(212,106,128,0.4)', gradient: ['#d46a80', '#8a3a4a'] },
  desire:         { solid: '#c05a70', glow: 'rgba(192,90,112,0.4)',  gradient: ['#c05a70', '#7a2a3a'] },
  romance:        { solid: '#d46a80', glow: 'rgba(212,106,128,0.4)', gradient: ['#d46a80', '#8a3a4a'] },
  sadness:        { solid: '#5a7a9a', glow: 'rgba(90,122,154,0.4)',  gradient: ['#5a7a9a', '#3a4a5a'] },
  disappointment: { solid: '#5a7a9a', glow: 'rgba(90,122,154,0.4)',  gradient: ['#5a7a9a', '#3a4a5a'] },
  distress:       { solid: '#6a7a8a', glow: 'rgba(106,122,138,0.4)', gradient: ['#6a7a8a', '#3a4a5a'] },
  nostalgia:      { solid: '#7a8a9a', glow: 'rgba(122,138,154,0.4)', gradient: ['#7a8a9a', '#4a5a6a'] },
  anger:          { solid: '#e05555', glow: 'rgba(224,85,85,0.4)',   gradient: ['#e05555', '#7a2a2a'] },
  contempt:       { solid: '#c04545', glow: 'rgba(192,69,69,0.4)',   gradient: ['#c04545', '#6a2020'] },
  disgust:        { solid: '#9a7a40', glow: 'rgba(154,122,64,0.4)',  gradient: ['#9a7a40', '#5a4a20'] },
  annoyance:      { solid: '#c06040', glow: 'rgba(192,96,64,0.4)',   gradient: ['#c06040', '#7a3a20'] },
  anxiety:        { solid: '#c07830', glow: 'rgba(192,120,48,0.4)',  gradient: ['#c07830', '#7a4a1a'] },
  fear:           { solid: '#9a6a9a', glow: 'rgba(154,106,154,0.4)', gradient: ['#9a6a9a', '#5a3a5a'] },
  horror:         { solid: '#8a4a6a', glow: 'rgba(138,74,106,0.4)',  gradient: ['#8a4a6a', '#4a2a3a'] },
  awkwardness:    { solid: '#9a8a70', glow: 'rgba(154,138,112,0.4)', gradient: ['#9a8a70', '#5a4a30'] },
  confusion:      { solid: '#8a8a6a', glow: 'rgba(138,138,106,0.4)', gradient: ['#8a8a6a', '#4a4a2a'] },
  calmness:       { solid: '#5a9a6a', glow: 'rgba(90,154,106,0.4)', gradient: ['#5a9a6a', '#2a5a3a'] },
  contentment:    { solid: '#5a9a6a', glow: 'rgba(90,154,106,0.4)', gradient: ['#5a9a6a', '#2a5a3a'] },
  relief:         { solid: '#6aaa7a', glow: 'rgba(106,170,122,0.4)',gradient: ['#6aaa7a', '#3a6a4a'] },
  satisfaction:   { solid: '#7aaa6a', glow: 'rgba(122,170,106,0.4)',gradient: ['#7aaa6a', '#4a6a3a'] },
  serenity:       { solid: '#5a9a8a', glow: 'rgba(90,154,138,0.4)', gradient: ['#5a9a8a', '#2a5a4a'] },
};

const DEFAULT_COLOR = { solid: '#444', glow: 'rgba(68,68,68,0.3)', gradient: ['#3a3535', '#1a1515'] };

function getEmotionColor(name) {
  return EMOTION_COLORS[(name || '').toLowerCase()] || DEFAULT_COLOR;
}

/* ---- Smoothing ---- */
// Exponential moving average over the last few readings to reduce jitter
const SMOOTH_ALPHA = 0.4; // 0 = no smoothing, 1 = no memory
let smoothedScores = {}; // { emotionName: smoothedScore }

function smoothEmotions(rawEmotions) {
  const newSmoothed = {};

  for (const e of rawEmotions) {
    const prev = smoothedScores[e.name] || 0;
    newSmoothed[e.name] = prev * (1 - SMOOTH_ALPHA) + e.score * SMOOTH_ALPHA;
  }

  // Decay emotions not in current reading
  for (const [name, score] of Object.entries(smoothedScores)) {
    if (!(name in newSmoothed)) {
      const decayed = score * (1 - SMOOTH_ALPHA);
      if (decayed > 0.01) newSmoothed[name] = decayed;
    }
  }

  smoothedScores = newSmoothed;

  return Object.entries(newSmoothed)
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
  const offset = TIMELINE_MAX - timeline.length;

  // Draw filled area
  ctx.beginPath();
  ctx.moveTo(offset * step, h);
  for (let i = 0; i < timeline.length; i++) {
    const x = (offset + i) * step;
    const y = h - (timeline[i].score * h * 0.85) - h * 0.05;
    if (i === 0) ctx.lineTo(x, y);
    else {
      const px = (offset + i - 1) * step;
      const py = h - (timeline[i - 1].score * h * 0.85) - h * 0.05;
      const cx = (px + x) / 2;
      ctx.bezierCurveTo(cx, py, cx, y, x, y);
    }
  }
  ctx.lineTo((offset + timeline.length - 1) * step, h);
  ctx.closePath();

  // Gradient fill using latest emotion color
  const latest = timeline[timeline.length - 1];
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, latest.color + '30');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fill();

  // Draw line
  ctx.beginPath();
  for (let i = 0; i < timeline.length; i++) {
    const x = (offset + i) * step;
    const y = h - (timeline[i].score * h * 0.85) - h * 0.05;
    if (i === 0) ctx.moveTo(x, y);
    else {
      const px = (offset + i - 1) * step;
      const py = h - (timeline[i - 1].score * h * 0.85) - h * 0.05;
      const cx = (px + x) / 2;
      ctx.bezierCurveTo(cx, py, cx, y, x, y);
    }
  }
  ctx.strokeStyle = latest.color;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw dots with emotion colors
  for (let i = 0; i < timeline.length; i++) {
    const x = (offset + i) * step;
    const y = h - (timeline[i].score * h * 0.85) - h * 0.05;
    ctx.beginPath();
    ctx.arc(x, y, i === timeline.length - 1 ? 4 : 2, 0, Math.PI * 2);
    ctx.fillStyle = timeline[i].color;
    ctx.fill();
  }

  // Latest dot glow
  if (timeline.length > 0) {
    const last = timeline.length - 1;
    const x = (offset + last) * step;
    const y = h - (timeline[last].score * h * 0.85) - h * 0.05;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = timeline[last].color + '40';
    ctx.fill();
  }
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

const CHUNK_DURATION = 1500; // 1.5 seconds for faster updates
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

/* ---- Auto-Start ---- */
startStreaming();
