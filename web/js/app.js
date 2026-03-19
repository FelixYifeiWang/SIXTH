/* ---- Configuration ---- */
const CONFIG = (() => {
  // Set window.CONNECTQ_API_URL before this script loads to connect to a remote backend.
  // Example: window.CONNECTQ_API_URL = "https://abc123.ngrok-free.dev"
  const apiUrl = (window.CONNECTQ_API_URL || '').replace(/\/+$/, '');
  return { API_URL: apiUrl };
})();

/* ---- Connection Status ---- */
function setConnected(connected) {
  document.getElementById('conn-server').classList.toggle('connected', connected);
}

// Ping the server to check connectivity
async function checkConnection() {
  try {
    const res = await fetch(CONFIG.API_URL + '/', { method: 'HEAD', mode: 'no-cors' });
    setConnected(true);
  } catch {
    setConnected(false);
  }
}

if (CONFIG.API_URL) {
  checkConnection();
  setInterval(checkConnection, 10000);
}

/* ---- Sentiment Color ---- */
function sentimentColor(s) {
  switch ((s || '').toLowerCase()) {
    case 'happy': case 'love': return { bg: 'rgba(212,168,84,0.2)', color: '#d4a854' };
    case 'sad': return { bg: 'rgba(90,122,154,0.2)', color: '#5a7a9a' };
    case 'mad': return { bg: 'rgba(224,85,85,0.2)', color: '#e05555' };
    case 'anxious': return { bg: 'rgba(192,120,48,0.2)', color: '#c07830' };
    default: return { bg: 'rgba(120,120,120,0.15)', color: '#888' };
  }
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
    showTranscript('Uploading...', '');

    try {
      const res = await fetch(CONFIG.API_URL + '/upload_audio', { method: 'POST', body: form });
      const data = await res.json();
      showTranscript(data.transcript || '', data.sentiment || '');
      setConnected(true);
    } catch (err) {
      showTranscript('Upload failed — check server connection', '');
      setConnected(false);
    }
  };

  mediaRecorder.start();
  setRecording(true);
}

function setRecording(on) {
  document.getElementById('voice-btn').textContent = on ? 'Stop Recording' : 'Start Recording';
  document.getElementById('voice-btn').classList.toggle('recording', on);
  document.getElementById('ring').classList.toggle('recording', on);
}

function showTranscript(text, sentiment) {
  const transcriptEl = document.getElementById('voice-transcript');
  const pillEl = document.getElementById('sentiment-pill');

  if (text) {
    transcriptEl.textContent = text.startsWith('Upload') ? text : '\u201C' + text + '\u201D';
    transcriptEl.classList.remove('typing');
    void transcriptEl.offsetWidth;
    transcriptEl.classList.add('typing');

    if (sentiment) {
      const sc = sentimentColor(sentiment);
      pillEl.textContent = sentiment;
      pillEl.style.background = sc.bg;
      pillEl.style.color = sc.color;
      pillEl.style.display = 'inline-block';
      pillEl.classList.remove('pop');
      void pillEl.offsetWidth;
      pillEl.classList.add('pop');
    } else {
      pillEl.style.display = 'none';
    }
  } else {
    transcriptEl.textContent = '';
    pillEl.style.display = 'none';
  }
}
