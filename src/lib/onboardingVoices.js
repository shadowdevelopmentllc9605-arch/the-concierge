// Browser speech voices expose a name and language, but no reliable gender field.
// Never silently use the browser's default (often feminine) when Tyler is selected.
const maleNames = [
  'Google UK English Male', 'Microsoft Guy', 'Microsoft Ryan', 'Microsoft Davis',
  'Microsoft David', 'Microsoft Mark', 'Microsoft Andrew', 'Microsoft Christopher',
  'Daniel', 'Alex', 'Thomas', 'Aaron', 'Arthur', 'Fred', 'David',
  'Ryan', 'Guy', 'James', 'John', 'Adam'
];
const femaleNames = [
  'Samantha', 'Susan', 'Karen', 'Victoria', 'Zira', 'Moira', 'Fiona',
  'Lisa', 'Emily', 'Ava', 'Allison', 'Kate', 'Female'
];

const isEnglish = voice => /^en(?:[-_]|$)/i.test(voice?.lang || '');
const isFemaleNamed = name => /(?:^|\W)female(?:\W|$)/i.test(name) ||
  femaleNames.some(label => new RegExp('(?:^|[^a-z])' + label + '(?:$|[^a-z])', 'i').test(name));

// Match words, not fragments ("Samantha" must never match "man").
export function chooseOnboardingVoice(voices = [], conciergeId) {
  const english = voices.filter(isEnglish);
  if (conciergeId === 'tyler') {
    const candidates = english.filter(v => !isFemaleNamed(v.name || ''));
    const named = maleNames.find(label =>
      candidates.some(v => (v.name || '').toLowerCase().includes(label.toLowerCase())));
    if (named) return candidates.find(v =>
      (v.name || '').toLowerCase().includes(named.toLowerCase()));
    return candidates.find(v => /(?:^|[^a-z])male(?:$|[^a-z])/i.test(v.name || '') ||
      /(?:^|[-_#])male(?:[-_#]|\d|$)/i.test(v.voiceURI || '')) || null;
  }
  if (conciergeId === 'megan') {
    return english.find(v => isFemaleNamed(v.name || '')) ||
      english[english.length - 1] || null;
  }
  return null;
}

export function loadOnboardingVoices(synth, timeoutMs = 1200) {
  return new Promise(resolve => {
    if (!synth || typeof synth.getVoices !== 'function') return resolve([]);
    const available = synth.getVoices() || [];
    if (available.length) return resolve(available);
    let finished = false;
    let timer;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (typeof synth.removeEventListener === 'function') {
        synth.removeEventListener('voiceschanged', onChanged);
      }
      resolve(synth.getVoices() || []);
    };
    const onChanged = () => {
      if ((synth.getVoices() || []).length) finish();
    };
    if (typeof synth.addEventListener === 'function') {
      synth.addEventListener('voiceschanged', onChanged);
    }
    timer = setTimeout(finish, timeoutMs);
  });
}

// Returns a reason if narration cannot begin; caller can keep the text visible.
// A generation guard prevents late voice-loading events from speaking on an old page.
export async function speakOnboardingMessage({
  concierge, message, onend, onerror, isCurrent = () => true
}) {
  if (!message || !concierge || typeof window === 'undefined' ||
      !window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
    return { spoken: false, reason: 'speech_unavailable' };
  }
  const synth = window.speechSynthesis;
  const voices = await loadOnboardingVoices(synth);
  if (!isCurrent()) return { spoken: false, reason: 'cancelled' };
  const voice = chooseOnboardingVoice(voices, concierge.id);
  if (concierge.id === 'tyler' && !voice) {
    synth.cancel();
    return { spoken: false, reason: 'masculine_voice_unavailable' };
  }
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(message);
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang || 'en-US';
  utterance.rate = 0.92;
  utterance.pitch = concierge.id === 'tyler' ? 0.95 : 1.12;
  utterance.volume = 1;
  utterance.onend = () => { if (isCurrent()) onend?.(); };
  utterance.onerror = error => { if (isCurrent()) onerror?.(error); };
  synth.speak(utterance);
  return { spoken: true, voiceName: voice?.name || null };
}
