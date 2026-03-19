/* ---- Configuration ---- */
const CONFIG = (() => {
  const apiUrl = (window.CONNECTQ_API_URL || '').replace(/\/+$/, '');
  const wsProto = apiUrl.startsWith('https') ? 'wss' : 'ws';
  const wsUrl = apiUrl ? apiUrl.replace(/^http/, 'ws') : `ws://${location.host}`;
  return { API_URL: apiUrl, WS_URL: wsUrl };
})();

/* ---- Connection Status ---- */
function setConnected(connected) {
  document.getElementById('conn-server').classList.toggle('connected', connected);
}

/* ---- Emotion Color ---- */
function emotionColor(name) {
  const n = (name || '').toLowerCase();
  if (['joy', 'amusement', 'excitement', 'interest', 'pride', 'triumph'].includes(n))
    return { bg: 'rgba(212,168,84,0.2)', color: '#d4a854' };
  if (['love', 'admiration', 'adoration', 'desire', 'romance'].includes(n))
    return { bg: 'rgba(212,168,84,0.2)', color: '#d4a854' };
  if (['sadness', 'disappointment', 'distress', 'nostalgia', 'empathic pain'].includes(n))
    return { bg: 'rgba(90,122,154,0.2)', color: '#5a7a9a' };
  if (['anger', 'contempt', 'disgust', 'annoyance'].includes(n))
    return { bg: 'rgba(224,85,85,0.2)', color: '#e05555' };
  if (['anxiety', 'fear', 'horror', 'awkwardness', 'confusion'].includes(n))
    return { bg: 'rgba(192,120,48,0.2)', color: '#c07830' };
  if (['calmness', 'contentment', 'relief', 'satisfaction', 'serenity'].includes(n))
    return { bg: 'rgba(90,154,106,0.2)', color: '#5a9a6a' };
  return { bg: 'rgba(120,120,120,0.15)', color: '#888' };
}

/* ---- Real-Time Voice Streaming ---- */
let audioStream = null;
let mediaRecorder = null;
let voiceWs = null;
let isStreaming = false;
let chunkInterval = null;

const CHUNK_DURATION = 2000; // 2 seconds per chunk for near real-time

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
    showEmotion('Microphone access denied', '', null);
    return;
  }

  // Connect WebSocket to server
  voiceWs = new WebSocket(CONFIG.WS_URL + '/ws/voice');

  voiceWs.onopen = () => {
    setConnected(true);
    isStreaming = true;
    setRecording(true);
    showEmotion('Listening...', '', null);
    startChunkedRecording();
  };

  voiceWs.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'emotion') {
      showEmotion('', data.emotion, data.top_emotions);
    } else if (data.type === 'error') {
      showEmotion(data.message || 'Error', '', null);
    }
  };

  voiceWs.onclose = () => {
    if (isStreaming) stopStreaming();
  };

  voiceWs.onerror = () => {
    showEmotion('Connection failed', '', null);
    setConnected(false);
    stopStreaming();
  };
}

function startChunkedRecording() {
  // Record in CHUNK_DURATION segments, send each as a complete audio blob
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
        const base64 = reader.result.split(',')[1]; // strip data:audio/webm;base64,
        if (voiceWs && voiceWs.readyState === WebSocket.OPEN) {
          voiceWs.send(JSON.stringify({ type: 'audio', data: base64 }));
        }
      };
      reader.readAsDataURL(blob);

      // Start next chunk immediately
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
}

function setRecording(on) {
  document.getElementById('voice-btn').textContent = on ? 'Stop' : 'Start';
  document.getElementById('voice-btn').classList.toggle('recording', on);
  document.getElementById('ring').classList.toggle('recording', on);
}

function showEmotion(statusText, emotion, topEmotions) {
  const transcriptEl = document.getElementById('voice-transcript');
  const pillEl = document.getElementById('sentiment-pill');
  const detailEl = document.getElementById('emotion-detail');

  if (statusText) {
    transcriptEl.textContent = statusText;
    transcriptEl.classList.remove('typing');
    void transcriptEl.offsetWidth;
    transcriptEl.classList.add('typing');
  }

  if (emotion) {
    transcriptEl.textContent = '';
    const ec = emotionColor(emotion);
    pillEl.textContent = emotion;
    pillEl.style.background = ec.bg;
    pillEl.style.color = ec.color;
    pillEl.style.display = 'inline-block';
    pillEl.classList.remove('pop');
    void pillEl.offsetWidth;
    pillEl.classList.add('pop');
  } else if (!statusText) {
    pillEl.style.display = 'none';
  }

  if (detailEl && topEmotions && topEmotions.length > 0) {
    detailEl.innerHTML = topEmotions.map(e => {
      const pct = Math.round(e.score * 100);
      const ec = emotionColor(e.name);
      return `<span class="emotion-tag" style="color:${ec.color}">${e.name} ${pct}%</span>`;
    }).join(' ');
    detailEl.style.display = 'block';
  } else if (detailEl && !topEmotions) {
    detailEl.style.display = 'none';
  }
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

if (CONFIG.API_URL) {
  checkConnection();
}
