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

/* ---- Orb + UI Update ---- */
let prevEmotion = '';

function updateEmotion(emotion, topEmotions) {
  const ec = getEmotionColor(emotion);
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
  if (emotion !== prevEmotion) {
    labelEl.classList.add('changing');
    setTimeout(() => {
      labelEl.textContent = emotion;
      labelEl.style.color = ec.solid;
      setTimeout(() => labelEl.classList.remove('changing'), 250);
    }, 200);
    prevEmotion = emotion;
  }

  // Subtitle
  const subEl = document.getElementById('emotion-sub');
  if (topEmotions && topEmotions.length > 0) {
    const pct = Math.round(topEmotions[0].score * 100);
    subEl.textContent = `${pct}% confidence`;
    subEl.style.color = ec.solid;
  }

  // Bars
  const barsContainer = document.getElementById('emotion-bars');
  barsContainer.classList.add('visible');

  if (topEmotions) {
    for (let i = 0; i < 3; i++) {
      const e = topEmotions[i];
      if (e) {
        const pct = Math.round(e.score * 100);
        const barEc = getEmotionColor(e.name);
        document.getElementById(`bar-name-${i}`).textContent = e.name;
        document.getElementById(`bar-fill-${i}`).style.width = pct + '%';
        document.getElementById(`bar-fill-${i}`).style.background = barEc.solid;
        document.getElementById(`bar-pct-${i}`).textContent = pct + '%';
      } else {
        document.getElementById(`bar-name-${i}`).textContent = '--';
        document.getElementById(`bar-fill-${i}`).style.width = '0%';
        document.getElementById(`bar-pct-${i}`).textContent = '0%';
      }
    }
  }
}

function showStatus(text) {
  document.getElementById('emotion-label').textContent = text;
  document.getElementById('emotion-label').style.color = '';
  document.getElementById('emotion-sub').textContent = '';
  document.getElementById('emotion-sub').style.color = '';
}

/* ---- Real-Time Voice Streaming ---- */
let audioStream = null;
let mediaRecorder = null;
let voiceWs = null;
let isStreaming = false;

const CHUNK_DURATION = 2000;

async function toggle() {
  if (isStreaming) {
    stopStreaming();
    return;
  }
  startStreaming();
}

async function startStreaming() {
  try {
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    showStatus('Mic access denied');
    return;
  }

  voiceWs = new WebSocket(CONFIG.WS_URL + '/ws/voice');

  voiceWs.onopen = () => {
    setConnected(true);
    isStreaming = true;
    setRecording(true);
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
    if (isStreaming) stopStreaming();
  };

  voiceWs.onerror = () => {
    showStatus('Connection failed');
    setConnected(false);
    stopStreaming();
  };
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

function stopStreaming() {
  isStreaming = false;
  setRecording(false);

  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
  mediaRecorder = null;

  if (audioStream) {
    audioStream.getTracks().forEach(t => t.stop());
    audioStream = null;
  }
  if (voiceWs && voiceWs.readyState === WebSocket.OPEN) {
    voiceWs.send(JSON.stringify({ type: 'stop' }));
    voiceWs.close();
  }
  voiceWs = null;

  showStatus('Ready');
  document.getElementById('emotion-sub').textContent = 'Tap start to begin';
}

function setRecording(on) {
  document.getElementById('mic-btn').classList.toggle('recording', on);
  document.getElementById('mic-label').textContent = on ? 'Stop' : 'Start';
}

/* ---- Health Check ---- */
async function checkConnection() {
  try {
    const res = await fetch(CONFIG.API_URL + '/health');
    setConnected(res.ok);
  } catch {
    setConnected(false);
  }
}

if (CONFIG.API_URL) checkConnection();
