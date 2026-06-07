const tempoInput = document.getElementById('tempo');
const timeSignatureSelect = document.getElementById('timeSignature');
const noteValueSelect = document.getElementById('noteValue');
const accentBeatInput = document.getElementById('accentBeat');
const volumeInput = document.getElementById('volume');
const counter = document.getElementById('counter');
const beatDots = document.getElementById('beatDots');
const startButton = document.getElementById('start');
const stopButton = document.getElementById('stop');

let audioContext;
let schedulerHandle = null;
let beatPosition = 0;
let measure = 1;
let nextTickAt = 0;
let dotsCount = 0;
const pendingUiUpdates = [];

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.12;

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
  oscillator.type = isAccent ? 'triangle' : 'sine';
  oscillator.frequency.setValueAtTime(isAccent ? 1250 : 900, when);

  const peakVolume = Math.max(0.0001, volume * (isAccent ? 0.65 : 0.4));
  gainNode.gain.setValueAtTime(0.0001, when);
  gainNode.gain.exponentialRampToValueAtTime(peakVolume, when + 0.002);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, when + 0.055);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start(when);
  oscillator.stop(when + 0.06);
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
  counter.textContent = `Beat ${currentBeat} / ${beats} · Measure ${measure} · ${getNoteName(noteDenominator)}`;
  counter.classList.toggle('accent', isAccent);
  renderBeatDots(beats, currentBeat);
}

function clearPendingUiUpdates() {
  while (pendingUiUpdates.length > 0) {
    const timeoutHandle = pendingUiUpdates.pop();
    window.clearTimeout(timeoutHandle);
  }
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
  const uiUpdateHandle = window.setTimeout(
    () => updateCounter(currentBeat, beats, isAccent, noteDenominator),
    uiDelayMs,
  );
  pendingUiUpdates.push(uiUpdateHandle);

  beatPosition += stepInBeats;
  if (beatPosition >= beats) {
    beatPosition %= beats;
    measure += 1;
  }

  nextTickAt += tickDelay;
}

function scheduler() {
  if (!audioContext || schedulerHandle === null) {
    return;
  }

  while (nextTickAt < audioContext.currentTime + SCHEDULE_AHEAD_SEC) {
    scheduleTick();
  }
}

async function start() {
  if (schedulerHandle !== null) {
    return;
  }

  if (!audioContext) {
    audioContext = new AudioContext();
  }
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  beatPosition = 0;
  measure = 1;
  nextTickAt = audioContext.currentTime + 0.05;
  clearPendingUiUpdates();
  scheduler();
  schedulerHandle = window.setInterval(scheduler, LOOKAHEAD_MS);
  startButton.disabled = true;
  stopButton.disabled = false;
  document.body.classList.add('playing');
}

function stop() {
  if (schedulerHandle !== null) {
    window.clearInterval(schedulerHandle);
    schedulerHandle = null;
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

renderBeatDots(parseTimeSignature(timeSignatureSelect.value).beats, 1);
