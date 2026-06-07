const tempoInput = document.getElementById('tempo');
const timeSignatureSelect = document.getElementById('timeSignature');
const noteValueSelect = document.getElementById('noteValue');
const accentBeatInput = document.getElementById('accentBeat');
const volumeInput = document.getElementById('volume');
const counter = document.getElementById('counter');
const noteStatus = document.getElementById('noteStatus');
const beatDots = document.getElementById('beatDots');
const startButton = document.getElementById('start');
const stopButton = document.getElementById('stop');

let audioContext;
let schedulerIntervalId = null;
let beatPosition = 0;
let measure = 1;
let nextTickAt = 0;
let dotsCount = 0;
const pendingUiUpdates = new Set();

const SCHEDULER_INTERVAL_MS = 25;
const SCHEDULE_AHEAD_TIME_SEC = 0.12;
const INITIAL_SCHEDULE_OFFSET_SEC = 0.05;
const ACCENT_VOLUME_MULTIPLIER = 0.65;
const NORMAL_VOLUME_MULTIPLIER = 0.4;
const ACCENT_WAVE_TYPE = 'triangle';
const NORMAL_WAVE_TYPE = 'sine';
const MIN_GAIN_VALUE = 0.0001;
const ATTACK_TIME_SEC = 0.002;
const RELEASE_TIME_SEC = 0.055;
const CLICK_DURATION_SEC = 0.06;

const NOTE_NAMES = {
  2: 'Half notes',
  4: 'Quarter notes',
  8: 'Eighth notes',
  16: 'Sixteenth notes',
  32: 'Thirty-second notes',
};

function parseTimeSignature(value) {
  const [beats, denominator] = value.split('/').map(Number);
  return { beats, denominator };
}

function getSettings() {
  const tempo = Math.max(20, Math.min(300, Number(tempoInput.value) || 120));
  const { beats, denominator } = parseTimeSignature(timeSignatureSelect.value);
  const noteDenominator = Number(noteValueSelect.value);
  const accentBeat = Math.max(1, Math.min(beats, Number(accentBeatInput.value) || 1));
  const volume = Math.max(0, Math.min(100, Number(volumeInput.value) || 75)) / 100;

  accentBeatInput.max = String(beats);
  if (Number(accentBeatInput.value) > beats) {
    accentBeatInput.value = String(beats);
  }

  return { tempo, beats, denominator, noteDenominator, accentBeat, volume };
}

function getNoteName(noteDenominator) {
  return NOTE_NAMES[noteDenominator] || `1/${noteDenominator} notes`;
}

function playClickAt(when, isAccent, volume) {
  if (!audioContext) {
    audioContext = new AudioContext();
  }

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.type = isAccent ? ACCENT_WAVE_TYPE : NORMAL_WAVE_TYPE;
  oscillator.frequency.setValueAtTime(isAccent ? 1250 : 900, when);

  const peakVolume = Math.max(
    MIN_GAIN_VALUE,
    volume * (isAccent ? ACCENT_VOLUME_MULTIPLIER : NORMAL_VOLUME_MULTIPLIER),
  );
  gainNode.gain.setValueAtTime(MIN_GAIN_VALUE, when);
  gainNode.gain.exponentialRampToValueAtTime(peakVolume, when + ATTACK_TIME_SEC);
  gainNode.gain.exponentialRampToValueAtTime(MIN_GAIN_VALUE, when + RELEASE_TIME_SEC);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start(when);
  oscillator.stop(when + CLICK_DURATION_SEC);
}

function renderBeatDots(totalBeats, currentBeat) {
  if (dotsCount !== totalBeats) {
    beatDots.innerHTML = '';
    for (let i = 0; i < totalBeats; i += 1) {
      const dot = document.createElement('span');
      dot.className = 'dot';
      beatDots.appendChild(dot);
    }
    dotsCount = totalBeats;
  }

  const dots = beatDots.children;
  for (let i = 0; i < dots.length; i += 1) {
    dots[i].classList.toggle('active', i + 1 === currentBeat);
  }
}

function updateCounter(currentBeat, beats, isAccent, noteDenominator) {
  counter.textContent = `Beat ${currentBeat} / ${beats} · Measure ${measure}`;
  noteStatus.textContent = getNoteName(noteDenominator);
  counter.classList.toggle('accent', isAccent);
  renderBeatDots(beats, currentBeat);
}

function clearPendingUiUpdates() {
  for (const timeoutHandle of pendingUiUpdates) {
    window.clearTimeout(timeoutHandle);
  }
  pendingUiUpdates.clear();
}

function scheduleTick() {
  const { tempo, beats, denominator, noteDenominator, accentBeat, volume } = getSettings();
  const stepInBeats = denominator / noteDenominator;
  const tickDelay = (60 / tempo) * stepInBeats;

  const currentBeat = Math.floor(beatPosition) + 1;
  const isBeatStart = Number.isInteger(beatPosition);
  const isAccent = isBeatStart && currentBeat === accentBeat;

  playClickAt(nextTickAt, isAccent, volume);
  const uiDelayMs = Math.max(0, (nextTickAt - audioContext.currentTime) * 1000);
  const uiUpdateHandle = window.setTimeout(() => {
    pendingUiUpdates.delete(uiUpdateHandle);
    updateCounter(currentBeat, beats, isAccent, noteDenominator);
  }, uiDelayMs);
  pendingUiUpdates.add(uiUpdateHandle);

  beatPosition += stepInBeats;
  if (beatPosition >= beats) {
    beatPosition %= beats;
    measure += 1;
  }

  nextTickAt += tickDelay;
}

function scheduler() {
  if (!audioContext || schedulerIntervalId === null) {
    return;
  }

  while (nextTickAt < audioContext.currentTime + SCHEDULE_AHEAD_TIME_SEC) {
    scheduleTick();
  }
}

function start() {
  if (schedulerIntervalId !== null) {
    return;
  }

  if (!audioContext) {
    audioContext = new AudioContext();
  }

  const beginPlayback = () => {
    beatPosition = 0;
    measure = 1;
    nextTickAt = audioContext.currentTime + INITIAL_SCHEDULE_OFFSET_SEC;
    clearPendingUiUpdates();
    scheduler();
    schedulerIntervalId = window.setInterval(scheduler, SCHEDULER_INTERVAL_MS);
    startButton.disabled = true;
    stopButton.disabled = false;
    document.body.classList.add('playing');
  };

  if (audioContext.state === 'suspended') {
    audioContext.resume().then(beginPlayback);
    return;
  }

  beginPlayback();
}

function stop() {
  if (schedulerIntervalId !== null) {
    window.clearInterval(schedulerIntervalId);
    schedulerIntervalId = null;
  }

  clearPendingUiUpdates();
  startButton.disabled = false;
  stopButton.disabled = true;
  counter.classList.remove('accent');
  document.body.classList.remove('playing');
}

startButton.addEventListener('click', start);
stopButton.addEventListener('click', stop);
timeSignatureSelect.addEventListener('change', () => {
  const { beats } = parseTimeSignature(timeSignatureSelect.value);
  accentBeatInput.max = String(beats);
  if ((Number(accentBeatInput.value) || 1) > beats) {
    accentBeatInput.value = String(beats);
  }
  renderBeatDots(beats, Math.max(1, Math.floor(beatPosition) + 1));
});
noteValueSelect.addEventListener('change', () => {
  noteStatus.textContent = getNoteName(Number(noteValueSelect.value));
});

renderBeatDots(parseTimeSignature(timeSignatureSelect.value).beats, 1);
noteStatus.textContent = getNoteName(Number(noteValueSelect.value));
