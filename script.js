const tempoInput = document.getElementById('tempo');
const timeSignatureSelect = document.getElementById('timeSignature');
const noteValueSelect = document.getElementById('noteValue');
const accentBeatInput = document.getElementById('accentBeat');
const counter = document.getElementById('counter');
const startButton = document.getElementById('start');
const stopButton = document.getElementById('stop');

let audioContext;
let timerId = null;
let beatPosition = 0;
let measure = 1;

function parseTimeSignature(value) {
  const [beats, denominator] = value.split('/').map(Number);
  return { beats, denominator };
}

function getSettings() {
  const tempo = Math.max(20, Math.min(300, Number(tempoInput.value) || 120));
  const { beats, denominator } = parseTimeSignature(timeSignatureSelect.value);
  const noteDenominator = Number(noteValueSelect.value);
  const accentBeat = Math.max(1, Math.min(beats, Number(accentBeatInput.value) || 1));

  accentBeatInput.max = String(beats);
  if (Number(accentBeatInput.value) > beats) {
    accentBeatInput.value = String(beats);
  }

  return { tempo, beats, denominator, noteDenominator, accentBeat };
}

function playClick(isAccent) {
  if (!audioContext) {
    audioContext = new AudioContext();
  }

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.type = 'square';
  oscillator.frequency.value = isAccent ? 1200 : 900;
  gainNode.gain.value = isAccent ? 0.35 : 0.2;

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  const now = audioContext.currentTime;
  oscillator.start(now);
  oscillator.stop(now + 0.04);
}

function updateCounter(currentBeat, beats, isAccent) {
  counter.textContent = `Beat ${currentBeat} / ${beats} · Measure ${measure}`;
  counter.classList.toggle('accent', isAccent);
}

function tick() {
  const { tempo, beats, denominator, noteDenominator, accentBeat } = getSettings();
  const stepInBeats = denominator / noteDenominator;
  const beatDurationMs = (60 / tempo) * 1000;
  const tickDelay = beatDurationMs * stepInBeats;

  const currentBeat = Math.floor(beatPosition) + 1;
  const isBeatStart = Number.isInteger(beatPosition);
  const isAccent = isBeatStart && currentBeat === accentBeat;

  playClick(isAccent);
  updateCounter(currentBeat, beats, isAccent);

  beatPosition += stepInBeats;
  if (beatPosition >= beats) {
    beatPosition %= beats;
    measure += 1;
  }

  timerId = window.setTimeout(tick, tickDelay);
}

function start() {
  if (timerId !== null) {
    return;
  }

  beatPosition = 0;
  measure = 1;
  tick();
  startButton.disabled = true;
  stopButton.disabled = false;
}

function stop() {
  if (timerId !== null) {
    window.clearTimeout(timerId);
    timerId = null;
  }

  startButton.disabled = false;
  stopButton.disabled = true;
  counter.classList.remove('accent');
}

startButton.addEventListener('click', start);
stopButton.addEventListener('click', stop);
timeSignatureSelect.addEventListener('change', () => {
  const { beats } = parseTimeSignature(timeSignatureSelect.value);
  accentBeatInput.max = String(beats);
  if ((Number(accentBeatInput.value) || 1) > beats) {
    accentBeatInput.value = String(beats);
  }
});
