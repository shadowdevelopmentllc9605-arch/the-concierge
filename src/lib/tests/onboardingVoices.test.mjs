import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chooseOnboardingVoice, loadOnboardingVoices, speakOnboardingMessage } from '../onboardingVoices.js';

const voice = (name, lang = 'en-US', voiceURI = name) => ({ name, lang, voiceURI });

test('Tyler consistently prefers a specifically named masculine English voice', () => {
  const voices = [
    voice('Google US English'), voice('Samantha'),
    voice('Microsoft Guy Online (Natural)'), voice('Daniel', 'en-GB')
  ];
  assert.equal(chooseOnboardingVoice(voices, 'tyler')?.name, 'Microsoft Guy Online (Natural)');
  assert.equal(chooseOnboardingVoice([voice('Samantha'), voice('Daniel', 'en-GB')], 'tyler')?.name, 'Daniel');
});

test('Tyler never falls back to a default or gender-unknown English voice', () => {
  const voices = [voice('Samsung English (United States)'), voice('Google US English'), voice('Samantha')];
  assert.equal(chooseOnboardingVoice(voices, 'tyler'), null);
  assert.equal(chooseOnboardingVoice([voice('Female English')], 'tyler'), null);
  assert.equal(chooseOnboardingVoice([voice('Google English Male', 'de-DE')], 'tyler'), null);
  assert.equal(chooseOnboardingVoice([], 'tyler'), null);
});

test('Megan still selects a named feminine voice independently from Tyler', () => {
  assert.equal(chooseOnboardingVoice([voice('Microsoft Guy'), voice('Samantha')], 'megan')?.name, 'Samantha');
});

test('voice list loaded after the browser voiceschanged event is supported', async () => {
  let available = [];
  let listener;
  const synth = {
    getVoices: () => available,
    addEventListener: (_, callback) => { listener = callback; },
    removeEventListener: () => { listener = null; }
  };
  const pending = loadOnboardingVoices(synth, 100);
  available = [voice('Microsoft Guy')];
  listener();
  const result = await pending;
  assert.equal(result.length, 1);
  assert.equal(listener, null);
});

test('unavailable masculine voice does not invoke a feminine browser default', async () => {
  let spoken = 0;
  const oldWindow = globalThis.window;
  const oldUtterance = globalThis.SpeechSynthesisUtterance;
  globalThis.window = { speechSynthesis: {
    getVoices: () => [voice('Samantha'), voice('Google US English')],
    cancel: () => {}, speak: () => { spoken++; }
  }};
  globalThis.SpeechSynthesisUtterance = class {};
  try {
    const result = await speakOnboardingMessage({ concierge: { id: 'tyler' }, message: 'Welcome' });
    assert.equal(result.reason, 'masculine_voice_unavailable');
    assert.equal(spoken, 0);
  } finally {
    globalThis.window = oldWindow;
    globalThis.SpeechSynthesisUtterance = oldUtterance;
  }
});

test('intro and profile guide use shared voice selector; pitch alone is not the selector', () => {
  const intro = readFileSync('src/components/onboarding/ConciergeIntro.jsx', 'utf8');
  const guide = readFileSync('src/components/onboarding/ConciergeGuide.jsx', 'utf8');
  const profile = readFileSync('src/components/onboarding/ProfileSetup.jsx', 'utf8');
  for (const source of [intro, guide]) {
    assert.match(source, /speakOnboardingMessage/);
    assert.doesNotMatch(source, /new SpeechSynthesisUtterance/);
    assert.match(source, /masculine_voice_unavailable/);
  }
  assert.match(profile, /<ConciergeGuide concierge={concierge}/);
});
