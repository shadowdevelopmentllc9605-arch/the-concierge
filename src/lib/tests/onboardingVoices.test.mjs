import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { avatarAudioPath, speakOnboardingMessage, stopOnboardingSpeech } from '../onboardingVoices.js';

const prompts = JSON.parse(readFileSync('src/lib/avatarVoicePrompts.json', 'utf8'));
const hashes = {
'megan/closet':'e1c05cb6af3228bf5ea1122ee1f8edfc3e3840fa33a5bf34e897488e0c1b813f',
'megan/friends':'6a3ba1a0b2173d0847b57fda737a3ca2d79ee6821855ffac84c3db668e110268',
'megan/measurements':'7e4c687f11c7dd0a2adc44ce6ab270b1f0efea20100f40da49274ee139dabf0f',
'megan/profile':'a3d0e2488683ff35ee91c02ef8c6cf7c5e0ae7307db57301b1982cdd3ce1f857',
'megan/review':'c12221d432ae7e195c34ee9b63f8ad68d92e7194ff657af31613dd8dd6fcfe80',
'megan/style':'57930b32543b49ca22b4b38ffb2c5924fae66c17ffaed2c86c20ce615ce53b82',
'megan/welcome':'406f9e5957933e2ca9657d0d95166d861bf23a8b24168bebf7c822b806221bd9',
'tyler/closet':'d5990cfcef3cf2e49f451b7a19a42ce828d092fdec796a08215a94745477e04c',
'tyler/friends':'521feac0891d1b2535aebffb2333803f4f7fdbc3c0a4c9535bc8a1bad9db7f2b',
'tyler/measurements':'0ceaa61dc9c2b6bc19c4770cd96db0c547ed1ea439d61ca4706541b3e83f5d2b',
'tyler/profile':'ae0419534fca979a5b8a4ae582828fa632c2d286635bf1802637140fa54e5ecc',
'tyler/review':'c71e1d229de8ade96bc3fafe7eb4000c4ce8719cf669409239ec97fd309abf72',
'tyler/style':'9475d0cd45292609514b56b8ef6d7b127b0e7f2ca01fd67fc5208c6efcdf375a',
'tyler/welcome':'1824235e4fe961e22cef66d870dda56a9f7bc838d86f90d01607929cecf76736'
};

test('all 14 Qwen narration files match exact local asset hashes and app copy', () => {
  const sources = ['ConciergeIntro','ProfileSetup','BodyScan','StylePreferences','ClosetUpload','AddFriends']
    .map(name => readFileSync('src/components/onboarding/' + name + '.jsx', 'utf8'));
  for (const [avatar, messages] of Object.entries(prompts)) {
    assert.equal(Object.keys(messages).length, 7);
    for (const [key, text] of Object.entries(messages)) {
      assert.ok(sources.some(source => source.includes(text)), 'Unmatched app copy: ' + key);
      const asset = readFileSync('public/audio/' + avatar + '/' + key + '.mp3');
      assert.equal(createHash('sha256').update(asset).digest('hex'), hashes[avatar + '/' + key]);
      assert.equal(asset.subarray(0,3).toString('ascii'), 'ID3');
    }
  }
});

test('each avatar uses its own file; stop cancels previous audio; only current callback fires', async () => {
  const old = globalThis.window;
  const played = [];
  let stopped = 0, ended = 0, browser = 0;
  class Audio {
    constructor(path) { this.path = path; }
    play() { played.push(this); return Promise.resolve(); }
    pause() { stopped++; }
  }
  globalThis.window = { Audio, speechSynthesis: { cancel() {}, speak() { browser++; } } };
  try {
    for (const [id, messages] of Object.entries(prompts)) {
      for (const [key, message] of Object.entries(messages)) {
        const r = await speakOnboardingMessage({ concierge: { id }, message, onend: () => ended++ });
        assert.equal(r.spoken, true);
        assert.equal(played.at(-1).path, '/audio/' + id + '/' + key + '.mp3');
      }
    }
    assert.equal(stopped, 13);
    assert.equal(played[0].onended, null);
    played.at(-1).onended();
    assert.equal(ended, 1);
    assert.equal(browser, 0);
  } finally { stopOnboardingSpeech(); globalThis.window = old; }
});

test('blocked autoplay, missing narration and unknown avatar never use browser speech', async () => {
  const old = globalThis.window;
  let browser = 0;
  globalThis.window = { Audio: class { play() { return Promise.reject({ name: 'NotAllowedError' }); } pause() {} }, speechSynthesis: { cancel() {}, speak() { browser++; } } };
  try {
    for (const id of ['tyler','megan']) {
      assert.equal((await speakOnboardingMessage({ concierge: { id }, message: prompts[id].profile })).reason, 'audio_playback_blocked');
      assert.equal((await speakOnboardingMessage({ concierge: { id }, message: 'Unknown text' })).reason, 'narration_missing');
    }
    assert.equal(avatarAudioPath('unknown', prompts.tyler.profile), null);
    assert.equal(browser, 0);
  } finally { stopOnboardingSpeech(); globalThis.window = old; }
});
