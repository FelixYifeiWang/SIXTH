/* ---- State ---- */
const state = {
  emotion: { label: 'calm', microseconds: 1800 },
  motion: { magnitude: 420, pattern: 'constant' },
  temperature: { magnitude: 23.8, pattern: 'constant' },
  touch: false,
  voice: { transcript: '', sentiment: '' },
  connections: { giver: false, receiver: false },
  feed: []
};

let prevEmotion = 'calm';
let prevTouch = false;

/* ---- Floating Particles ---- */
const particleCanvas = document.getElementById('particles');
const pCtx = particleCanvas.getContext('2d');
let particles = [];

function resizeParticles() {
  const col = particleCanvas.parentElement;
  particleCanvas.width = col.clientWidth;
  particleCanvas.height = col.clientHeight;
}

function createParticles(count) {
  particles = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * particleCanvas.width,
      y: Math.random() * particleCanvas.height,
      r: 1 + Math.random() * 2,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      alpha: 0.1 + Math.random() * 0.2,
      color: [212, 168, 84] // amber, will shift with emotion
    });
  }
}

let particleColor = [90, 154, 106]; // calm green

function updateParticleColor(label) {
  const l = (label || '').toLowerCase();
  if (l.includes('happy') || l.includes('love')) particleColor = [212, 168, 84];
  else if (l.includes('sad')) particleColor = [90, 122, 154];
  else if (l.includes('mad') || l.includes('agitat')) particleColor = [224, 85, 85];
  else if (l.includes('anxious')) particleColor = [192, 120, 48];
  else particleColor = [90, 154, 106];
}

function drawParticles() {
  pCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
  for (const p of particles) {
    // Slowly drift color toward target
    p.color[0] += (particleColor[0] - p.color[0]) * 0.02;
    p.color[1] += (particleColor[1] - p.color[1]) * 0.02;
    p.color[2] += (particleColor[2] - p.color[2]) * 0.02;

    p.x += p.vx;
    p.y += p.vy;

    // Wrap edges
    if (p.x < 0) p.x = particleCanvas.width;
    if (p.x > particleCanvas.width) p.x = 0;
    if (p.y < 0) p.y = particleCanvas.height;
    if (p.y > particleCanvas.height) p.y = 0;

    pCtx.beginPath();
    pCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    const [r, g, b] = p.color.map(Math.round);
    pCtx.fillStyle = `rgba(${r},${g},${b},${p.alpha})`;
    pCtx.fill();
  }
  requestAnimationFrame(drawParticles);
}

window.addEventListener('resize', () => {
  resizeParticles();
  createParticles(40);
});
resizeParticles();
createParticles(40);
drawParticles();

/* ---- Emotion Color Map ---- */
function emotionColor(label) {
  const l = (label || '').toLowerCase();
  if (l.includes('happy') || l.includes('love') || l.includes('joy'))
    return { bg: 'radial-gradient(circle at 40% 40%, #d4a854, #8a6a30)', shadow: 'rgba(212,168,84,0.35)', glow: '#d4a854' };
  if (l.includes('sad') || l.includes('lonely'))
    return { bg: 'radial-gradient(circle at 40% 40%, #5a7a9a, #3a4a5a)', shadow: 'rgba(90,122,154,0.35)', glow: '#5a7a9a' };
  if (l.includes('mad') || l.includes('agitat') || l.includes('anger') || l.includes('frustrat'))
    return { bg: 'radial-gradient(circle at 40% 40%, #e05555, #7a2a2a)', shadow: 'rgba(224,85,85,0.35)', glow: '#e05555' };
  if (l.includes('anxious') || l.includes('stress') || l.includes('nervous'))
    return { bg: 'radial-gradient(circle at 40% 40%, #c07830, #7a4a1a)', shadow: 'rgba(192,120,48,0.35)', glow: '#c07830' };
  if (l.includes('calm') || l.includes('neutral') || l.includes('content') || l.includes('peace'))
    return { bg: 'radial-gradient(circle at 40% 40%, #5a9a6a, #2a5a3a)', shadow: 'rgba(90,154,106,0.35)', glow: '#5a9a6a' };
  return { bg: 'radial-gradient(circle at 40% 40%, #4a4545, #2a2525)', shadow: 'rgba(80,80,80,0.2)', glow: '#4a4545' };
}

function intensityLabel(us) {
  if (us <= 700) return 'Intense';
  if (us <= 1100) return 'Active';
  if (us <= 1500) return 'Moderate';
  if (us <= 1900) return 'Gentle';
  return 'Very Gentle';
}

function breatheDuration(us) {
  return 1 + ((us - 500) / 2000) * 3;
}

function patternIcon(pattern) {
  switch (pattern) {
    case 'increasing': return '\u2191';
    case 'decreasing': return '\u2193';
    case 'variable': return '\u223C';
    default: return '\u2014';
  }
}

function sentimentColor(s) {
  switch ((s || '').toLowerCase()) {
    case 'happy': case 'love': return { bg: 'rgba(212,168,84,0.2)', color: '#d4a854' };
    case 'sad': return { bg: 'rgba(90,122,154,0.2)', color: '#5a7a9a' };
    case 'mad': return { bg: 'rgba(224,85,85,0.2)', color: '#e05555' };
    case 'anxious': return { bg: 'rgba(192,120,48,0.2)', color: '#c07830' };
    default: return { bg: 'rgba(120,120,120,0.15)', color: '#888' };
  }
}

/* ---- Trigger ripple from orb on emotion change ---- */
function triggerOrbRipple(color) {
  ['orb-ripple-1', 'orb-ripple-2'].forEach((id, i) => {
    const el = document.getElementById(id);
    el.style.color = color;
    el.classList.remove('animate');
    void el.offsetWidth; // reflow
    setTimeout(() => el.classList.add('animate'), i * 200);
  });
}

/* ---- Trigger touch ripple ---- */
function triggerTouchRipple() {
  const rings = document.querySelectorAll('.touch-ripple-ring');
  rings.forEach(ring => {
    ring.classList.remove('animate');
    void ring.offsetWidth;
    ring.classList.add('animate');
  });
}

/* ---- Render ---- */
function render() {
  const ec = emotionColor(state.emotion.label);
  const orb = document.getElementById('orb');
  orb.style.background = ec.bg;
  orb.style.boxShadow = `0 0 60px 20px ${ec.shadow}`;
  orb.style.animationDuration = breatheDuration(state.emotion.microseconds) + 's';

  // Ambient glow follows emotion
  const ambientGlow = document.getElementById('ambient-glow');
  ambientGlow.style.background = ec.glow;

  // Update particles color
  updateParticleColor(state.emotion.label);

  // Emotion label with crossfade if changed
  const labelEl = document.getElementById('emotion-label');
  if (state.emotion.label !== prevEmotion) {
    labelEl.classList.add('changing');
    triggerOrbRipple(ec.glow);
    setTimeout(() => {
      labelEl.textContent = state.emotion.label;
      setTimeout(() => labelEl.classList.remove('changing'), 300);
    }, 250);
    prevEmotion = state.emotion.label;
  }

  document.getElementById('emotion-intensity').textContent = intensityLabel(state.emotion.microseconds);

  // Motion
  const motionPct = Math.min((state.motion.magnitude / 5000) * 100, 100);
  document.getElementById('motion-bar').style.width = motionPct + '%';

  const motionVal = document.getElementById('motion-value');
  motionVal.textContent = Math.round(state.motion.magnitude);
  motionVal.classList.remove('flash');
  void motionVal.offsetWidth;
  motionVal.classList.add('flash');

  const motionIconEl = document.getElementById('motion-icon');
  const newIcon = patternIcon(state.motion.pattern);
  if (motionIconEl.textContent !== newIcon) {
    motionIconEl.textContent = newIcon;
    motionIconEl.classList.remove('bounce');
    void motionIconEl.offsetWidth;
    motionIconEl.classList.add('bounce');
  }
  document.getElementById('motion-pattern').textContent = state.motion.pattern;

  // Temperature
  const tempEl = document.getElementById('temp-value');
  const tempCard = document.getElementById('card-temp');
  if (state.temperature.magnitude !== null) {
    tempEl.textContent = state.temperature.magnitude.toFixed(1);
    const t = state.temperature.magnitude;
    if (t >= 26) {
      tempEl.style.color = '#d4a854';
      tempCard.style.background = 'linear-gradient(135deg, #1a1a1a 60%, rgba(212,168,84,0.06))';
    } else if (t <= 20) {
      tempEl.style.color = '#5a7a9a';
      tempCard.style.background = 'linear-gradient(135deg, #1a1a1a 60%, rgba(90,122,154,0.06))';
    } else {
      tempEl.style.color = 'var(--text)';
      tempCard.style.background = 'var(--surface)';
    }
  } else {
    tempEl.textContent = '\u2014';
    tempEl.style.color = 'var(--text-muted)';
    tempCard.style.background = 'var(--surface)';
  }

  const tempIconEl = document.getElementById('temp-icon');
  const newTempIcon = patternIcon(state.temperature.pattern);
  if (tempIconEl.textContent !== newTempIcon) {
    tempIconEl.textContent = newTempIcon;
    tempIconEl.classList.remove('bounce');
    void tempIconEl.offsetWidth;
    tempIconEl.classList.add('bounce');
  }
  document.getElementById('temp-pattern').textContent = state.temperature.pattern;

  // Touch
  const touchCircle = document.getElementById('touch-circle');
  const touchLabel = document.getElementById('touch-label');
  const wasTouch = prevTouch;
  touchCircle.classList.toggle('active', state.touch);
  touchLabel.classList.toggle('active', state.touch);
  touchLabel.textContent = state.touch ? 'Detected' : 'No contact';

  if (state.touch && !wasTouch) {
    triggerTouchRipple();
  }
  prevTouch = state.touch;

  // Connections
  document.getElementById('conn-giver').classList.toggle('connected', state.connections.giver);
  document.getElementById('conn-receiver').classList.toggle('connected', state.connections.receiver);

  // Voice
  const transcriptEl = document.getElementById('voice-transcript');
  const pillEl = document.getElementById('sentiment-pill');
  if (state.voice.transcript) {
    transcriptEl.textContent = '\u201C' + state.voice.transcript + '\u201D';
    transcriptEl.classList.remove('typing');
    void transcriptEl.offsetWidth;
    transcriptEl.classList.add('typing');

    if (state.voice.sentiment) {
      const sc = sentimentColor(state.voice.sentiment);
      pillEl.textContent = state.voice.sentiment;
      pillEl.style.background = sc.bg;
      pillEl.style.color = sc.color;
      pillEl.style.display = 'inline-block';
      pillEl.classList.remove('pop');
      void pillEl.offsetWidth;
      pillEl.classList.add('pop');
    }
  } else {
    transcriptEl.textContent = '';
    pillEl.style.display = 'none';
  }

  renderFeed();
}

function renderFeed() {
  const list = document.getElementById('feed-list');
  list.innerHTML = state.feed.map(entry => {
    return `<div class="feed-entry">
      <span class="feed-time">${entry.time}</span>
      <span class="feed-msg">${entry.html}</span>
    </div>`;
  }).join('');
}

function addFeedEntry(message, type) {
  const now = new Date();
  const time = now.toTimeString().slice(0, 8);
  const tag = type || 'system';
  const html = `<span class="tag-${tag}">${message}</span>`;
  state.feed.unshift({ time, html });
  if (state.feed.length > 50) state.feed.pop();
  renderFeed();
}

function updateState(partial) {
  Object.assign(state.emotion, partial.emotion || {});
  Object.assign(state.motion, partial.motion || {});
  Object.assign(state.temperature, partial.temperature || {});
  if (partial.touch !== undefined) state.touch = partial.touch;
  Object.assign(state.voice, partial.voice || {});
  Object.assign(state.connections, partial.connections || {});
  render();
}

/* ---- Voice Recording ---- */
let mediaRecorder, chunks = [];

async function toggle() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    return;
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  chunks = [];

  mediaRecorder.ondataavailable = e => chunks.push(e.data);

  mediaRecorder.onstop = async () => {
    stream.getTracks().forEach(t => t.stop());
    const blob = new Blob(chunks, { type: mediaRecorder.mimeType });
    const form = new FormData();
    form.append('file', blob, 'recording.webm');

    setRecording(false);
    addFeedEntry('Uploading voice...', 'voice');

    try {
      const res = await fetch('/upload_audio', { method: 'POST', body: form });
      const data = await res.json();
      updateState({
        voice: { transcript: data.transcript || '', sentiment: data.sentiment || '' }
      });
      if (data.transcript) {
        addFeedEntry(`Voice: \u201C${data.transcript}\u201D \u2014 ${data.sentiment}`, 'voice');
      }
    } catch (err) {
      addFeedEntry('Voice upload failed', 'system');
    }
  };

  mediaRecorder.start();
  setRecording(true);
  addFeedEntry('Recording started...', 'voice');
}

function setRecording(on) {
  document.getElementById('voice-btn').textContent = on ? 'Stop Recording' : 'Start Recording';
  document.getElementById('voice-btn').classList.toggle('recording', on);
  document.getElementById('ring').classList.toggle('recording', on);
}

/* ---- Mock Data ---- */
function initMockData() {
  const mockFeed = [
    { offset: 0, msg: 'Emotion: calm (1800\u00B5s)', type: 'emotion' },
    { offset: 12, msg: 'Motion: constant @ 420', type: 'motion' },
    { offset: 25, msg: 'Temperature: 23.8\u00B0C constant', type: 'temp' },
    { offset: 45, msg: 'Touch detected', type: 'touch' },
    { offset: 60, msg: 'Emotion: gentle warmth (2000\u00B5s)', type: 'emotion' },
    { offset: 90, msg: 'System connected', type: 'system' },
  ];

  const now = new Date();
  mockFeed.forEach(item => {
    const t = new Date(now.getTime() - item.offset * 1000);
    const time = t.toTimeString().slice(0, 8);
    const html = `<span class="tag-${item.type}">${item.msg}</span>`;
    state.feed.push({ time, html });
  });

  render();
}

function startMockDrift() {
  const emotions = [
    { label: 'calm', microseconds: 1800 },
    { label: 'gentle warmth', microseconds: 2000 },
    { label: 'happy', microseconds: 1600 },
    { label: 'mild anxiety', microseconds: 1200 },
    { label: 'calm', microseconds: 1800 },
  ];
  let idx = 0;

  setInterval(() => {
    const mag = 300 + Math.random() * 400;
    const patterns = ['constant', 'constant', 'increasing', 'variable'];
    updateState({
      motion: { magnitude: mag, pattern: patterns[Math.floor(Math.random() * patterns.length)] }
    });
  }, 4000);

  setInterval(() => {
    const temp = 22.5 + Math.random() * 3;
    const tPatterns = ['constant', 'constant', 'increasing', 'decreasing'];
    updateState({
      temperature: { magnitude: temp, pattern: tPatterns[Math.floor(Math.random() * tPatterns.length)] }
    });
  }, 8000);

  setInterval(() => {
    idx = (idx + 1) % emotions.length;
    updateState({ emotion: emotions[idx] });
    addFeedEntry(`Emotion: ${emotions[idx].label} (${emotions[idx].microseconds}\u00B5s)`, 'emotion');
  }, 12000);

  setInterval(() => {
    updateState({ touch: true });
    addFeedEntry('Touch detected', 'touch');
    setTimeout(() => updateState({ touch: false }), 3000);
  }, 20000);
}

/* ---- Init ---- */
initMockData();
startMockDrift();
