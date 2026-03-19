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
    showTranscript('Uploading...', '', null);

    try {
      const res = await fetch('/upload_audio', { method: 'POST', body: form });
      const data = await res.json();
      if (data.status === 'error') {
        showTranscript(data.message || 'Analysis failed', '', null);
      } else {
        showTranscript(data.transcript || '', data.emotion || '', data.top_emotions || []);
      }
    } catch (err) {
      showTranscript('Upload failed', '', null);
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

function showTranscript(text, emotion, topEmotions) {
  const transcriptEl = document.getElementById('voice-transcript');
  const pillEl = document.getElementById('sentiment-pill');
  const detailEl = document.getElementById('emotion-detail');

  if (text) {
    const isStatus = text.startsWith('Upload') || text.startsWith('Analysis');
    transcriptEl.textContent = isStatus ? text : '\u201C' + text + '\u201D';
    transcriptEl.classList.remove('typing');
    void transcriptEl.offsetWidth;
    transcriptEl.classList.add('typing');

    if (emotion) {
      const ec = emotionColor(emotion);
      pillEl.textContent = emotion;
      pillEl.style.background = ec.bg;
      pillEl.style.color = ec.color;
      pillEl.style.display = 'inline-block';
      pillEl.classList.remove('pop');
      void pillEl.offsetWidth;
      pillEl.classList.add('pop');
    } else {
      pillEl.style.display = 'none';
    }

    if (detailEl && topEmotions && topEmotions.length > 0) {
      detailEl.innerHTML = topEmotions.map(e => {
        const pct = Math.round(e.score * 100);
        const ec = emotionColor(e.name);
        return `<span class="emotion-tag" style="color:${ec.color}">${e.name} ${pct}%</span>`;
      }).join(' ');
      detailEl.style.display = 'block';
    } else if (detailEl) {
      detailEl.style.display = 'none';
    }
  } else {
    transcriptEl.textContent = '';
    pillEl.style.display = 'none';
    if (detailEl) detailEl.style.display = 'none';
  }
}
