import prompts from './avatarVoicePrompts.json' with { type: 'json' };

let activeAudio = null;

export function stopOnboardingSpeech() {
  if (activeAudio) {
    const audio = activeAudio;
    activeAudio = null;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
  }
  if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
}

export function avatarAudioPath(conciergeId, message) {
  if (conciergeId !== 'tyler' && conciergeId !== 'megan') return null;
  const key = Object.keys(prompts[conciergeId]).find(id => prompts[conciergeId][id] === message);
  return key ? '/audio/' + conciergeId + '/' + key + '.mp3' : null;
}

export async function speakOnboardingMessage({
  concierge, message, onend, onerror, isCurrent = () => true
}) {
  if (!isCurrent()) return { spoken: false, reason: 'cancelled' };
  const path = avatarAudioPath(concierge?.id, message);
  if (!path) return { spoken: false, reason: 'narration_missing' };
  if (typeof window === 'undefined' || typeof window.Audio !== 'function') {
    return { spoken: false, reason: 'audio_unavailable' };
  }
  stopOnboardingSpeech();
  let audio;
  try {
    audio = new window.Audio(path);
    activeAudio = audio;
    const finish = callback => {
      if (activeAudio !== audio) return;
      activeAudio = null;
      audio.onended = null;
      audio.onerror = null;
      if (isCurrent()) callback?.();
    };
    audio.onended = () => finish(onend);
    audio.onerror = () => finish(onerror);
    await audio.play();
    if (!isCurrent()) {
      if (activeAudio === audio) stopOnboardingSpeech();
      return { spoken: false, reason: 'cancelled' };
    }
    return { spoken: true, voiceName: concierge.id === 'tyler' ? 'Tyler' : 'Megan' };
  } catch (error) {
    if (audio && activeAudio === audio) stopOnboardingSpeech();
    return { spoken: false, reason: error?.name === 'NotAllowedError' ? 'audio_playback_blocked' : 'audio_unavailable' };
  }
}
