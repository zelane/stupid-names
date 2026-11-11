// Pronunciation: IPA transcriptions and the browser's built-in voices.
import { VOW, W, PARTS, nickSyllables, latinCons } from './codec.js';

// In a full name, every syllable after the first follows a vowel; in a nickname, none does
const latinSyl = (s, between) => latinCons(s.c, between) + VOW[s.v];
// Every sound is already an IPA symbol; tones use Chao tone letters
const IPA_TONES = ['˧', '˧˥', '˥˩', '˧˥˩', '˨˩˦'];
export const ipaFull = name => '/' + PARTS.map(k => 'ˈ' + name[k].map((s, i) => latinSyl(s, i > 0)).join('.')).join(' ') + '/';
export const ipaNick = name => '/' + PARTS.map(k => 'ˈ' + nickSyllables(name[k]).map(s =>
  latinSyl(s, false) + (s.closing ? latinCons(s.closing.c, false) + IPA_TONES[s.closing.tone] : '')).join('.')).join(' ') + '/';

// Browser voices read spelling by their own language's rules. Spanish and Italian
// spell these sounds the way we do; otherwise fall back to an English respelling.
const PHONETIC_LANGS = ['es', 'it', 'pt', 'id', 'fi'];
const EN_VOWELS = ['ah', 'eh', 'ee', 'oh', 'oo'];
// Nickname tones as rough pitch shifts, one syllable at a time
const TONE_PITCH = [1, 1.45, 0.65, 1.2, 0.8];

export const canSpeak = typeof speechSynthesis !== 'undefined';
if (canSpeak) speechSynthesis.getVoices();   // starts voice loading in some browsers

function pickVoice() {
  const voices = speechSynthesis.getVoices();
  for (const lang of PHONETIC_LANGS) {
    const v = voices.find(v => v.lang.toLowerCase().startsWith(lang));
    if (v) return { voice: v, phonetic: true };
  }
  return { voice: voices.find(v => v.default) || voices[0] || null, phonetic: false };
}
function sayText(s, phonetic, between) {
  const v = phonetic ? VOW[s.v] : EN_VOWELS[s.v];
  // A closing w is voiced as u (pau, not paw), which reads more naturally aloud
  return latinCons(s.c, between) + v + (!s.closing ? '' : s.closing.c === W ? 'u' : latinCons(s.closing.c, false));
}

// Says an encoded name, in full or as its nickname
export function speak(name, nick) {
  speechSynthesis.cancel();
  const { voice, phonetic } = pickVoice();
  const utter = (text, pitch = 1) => {
    const u = new SpeechSynthesisUtterance(text);
    if (voice) { u.voice = voice; u.lang = voice.lang; }
    u.pitch = pitch;
    u.rate = 0.85;
    speechSynthesis.speak(u);
  };
  if (!nick) {
    utter(PARTS.map(k => name[k].map((s, i) => sayText(s, phonetic, i > 0)).join(phonetic ? '' : '-')).join(', '));
  } else {
    PARTS.forEach(k => nickSyllables(name[k]).forEach(s => utter(sayText(s, phonetic, false), s.closing ? TONE_PITCH[s.closing.tone] : 1)));
  }
}
