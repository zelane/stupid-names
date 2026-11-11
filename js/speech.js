// Pronunciation: IPA transcriptions and the browser's built-in voices.
import { CONS, VOW, PARTS, nickSyllables } from './codec.js';
import { SCRIPTS } from './scripts.js';

const latinSyl = s => CONS[s.c] + VOW[s.v];
// Every sound is already an IPA symbol; tones use Chao tone letters
const IPA_TONES = ['˧', '˧˥', '˥˩', '˧˥˩'];
export const ipaFull = name => '/' + PARTS.map(k => 'ˈ' + name[k].map(latinSyl).join('.')).join(' ') + '/';
export const ipaNick = name => '/' + PARTS.map(k => 'ˈ' + nickSyllables(name[k]).map(s =>
  latinSyl(s) + (s.closing ? CONS[s.closing.c] + IPA_TONES[s.closing.tone] : '')).join('.')).join(' ') + '/';

// Browser voices read spelling by their own language's rules. Spanish and Italian
// spell these sounds the way we do; otherwise fall back to an English respelling.
const PHONETIC_LANGS = ['es', 'it', 'pt', 'id', 'fi'];
const EN_VOWELS = ['ah', 'eh', 'ee', 'oh'];
// Nickname tones as rough pitch shifts, one syllable at a time
const TONE_PITCH = [1, 1.45, 0.65, 1.2];

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
function sayText(s, phonetic) {
  const v = phonetic ? VOW[s.v] : EN_VOWELS[s.v];
  return CONS[s.c] + v + (!s.closing ? '' : phonetic ? SCRIPTS.latin.coda(s.closing.c) : CONS[s.closing.c]);
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
    utter(PARTS.map(k => name[k].map(s => sayText(s, phonetic)).join(phonetic ? '' : '-')).join(', '));
  } else {
    PARTS.forEach(k => nickSyllables(name[k]).forEach(s => utter(sayText(s, phonetic), s.closing ? TONE_PITCH[s.closing.tone] : 1)));
  }
}
