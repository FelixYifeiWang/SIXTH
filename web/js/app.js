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
let audioContext = null;
let processor = null;
let voiceWs = null;
let isStreaming = false;

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

  // Connect WebSocket to server's voice stream endpoint
  voiceWs = new WebSocket(CONFIG.WS_URL + '/ws/voice');

  voiceWs.onopen = () => {
    setConnected(true);
    isStreaming = true;
    setRecording(true);
    showEmotion('Listening...', '', null);
    startAudioCapture();
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
    stopStreaming();
  };

  voiceWs.onerror = () => {
    showEmotion('Connection failed', '', null);
    setConnected(false);
    stopStreaming();
  };
}

function startAudioCapture() {
  audioContext = new AudioContext({ sampleRate: 16000 });
  const source = audioContext.createMediaStreamSource(audioStream);

  // Use ScriptProcessorNode to capture raw PCM audio
  processor = audioContext.createScriptProcessor(4096, 1, 1);
  processor.onaudioprocess = (e) => {
    if (!voiceWs || voiceWs.readyState !== WebSocket.OPEN) return;

    const float32 = e.inputBuffer.getChannelData(0);
    // Convert float32 PCM to int16 for smaller payload
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      int16[i] = Math.max(-32768, Math.min(32767, Math.round(float32[i] * 32767)));
    }

    // Base64 encode and send
    const bytes = new Uint8Array(int16.buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const b64 = btoa(binary);

    voiceWs.send(JSON.stringify({ type: 'audio', data: b64 }));
  };

  source.connect(processor);
  processor.connect(audioContext.destination);
}

function stopStreaming() {
  isStreaming = false;
  setRecording(false);

  if (processor) {
    processor.disconnect();
    processor = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
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
