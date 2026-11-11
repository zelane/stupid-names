// Writing systems: spelling an encoded name in a script, and reading any script back.
import { CONS, VOW, W, TONES, PARTS, nickSyllables, decodeLatin } from './codec.js';

// Every script spells the same 8 consonants (p t v s m n l w) and 4 vowels (a e i o) and
// provides: syllable(c, v); closed(c, v, closing) for a nickname syllable; finishWord(word);
// caps; and `reverse`, [its text, Latin] pairs for reading names back.

// Tones other than the Latin combining accents, read back as those accents
const toneReverse = tones => tones.map((t, i) => [t, TONES[i]]).filter(([t, l]) => t && t !== l);

// Letters for consonants and vowels. codaW is how a w closing a nickname syllable is
// written (u in Latin: Mau, not Maw); halant marks a consonant with no vowel of its own.
function alphabet({ label, cons, vow, codaW, tones = TONES, halant = '', caps = true, finishWord = w => w, extraReverse = [] }) {
  const coda = c => c === W ? codaW : cons[c] + halant;
  // A w written the same as a closing w reads as u, and a u before a vowel turns back into w
  const reverse = [
    ...cons.map((ch, c) => [ch, c === W ? 'u' : CONS[c]]), ...vow.map((ch, v) => [ch, VOW[v]]),
    [codaW, 'u'], ...toneReverse(tones), ...(halant ? [[halant, '']] : []), ...extraReverse
  ];
  return {
    label, caps, finishWord, coda, reverse,
    syllable: (c, v) => cons[c] + vow[v],
    closed: (c, v, cl) => cons[c] + vow[v] + tones[cl.tone] + coda(cl.c)
  };
}

// Ethiopic writes each consonant-vowel pair as one character, in rows of seven forms
const ETHIOPIC_ORDER = [3, 4, 2, 6];   // offsets of the a / e / i / o forms in each row
const ETHIOPIC_BARE = 5;               // offset of the form with no vowel
function ethiopic({ label, rows, tones }) {
  const ch = (c, off) => String.fromCodePoint(rows[c] + off);
  return {
    label, caps: false, finishWord: w => w,
    syllable: (c, v) => ch(c, ETHIOPIC_ORDER[v]),
    closed: (c, v, cl) => ch(c, ETHIOPIC_ORDER[v]) + tones[cl.tone] + ch(cl.c, ETHIOPIC_BARE),
    reverse: [
      ...rows.flatMap((_, c) => [...ETHIOPIC_ORDER.map((off, v) => [ch(c, off), CONS[c] + VOW[v]]), [ch(c, ETHIOPIC_BARE), CONS[c]]]),
      ...toneReverse(tones)
    ]
  };
}

// Hangul jamo indices for composing blocks: 0xAC00 + (initial * 21 + vowel) * 28 + final
const HANGUL_L = [17, 16, 7, 9, 6, 2, 5, 11];        // ㅍ ㅌ ㅂ ㅅ ㅁ ㄴ ㄹ ㅇ
const HANGUL_V = [0, 5, 20, 8], HANGUL_WV = [9, 15, 16, 14];   // ㅏ ㅔ ㅣ ㅗ, after w ㅘ ㅞ ㅟ ㅝ
const HANGUL_T = [26, 25, 17, 19, 16, 4, 8];         // finals ㅍ ㅌ ㅂ ㅅ ㅁ ㄴ ㄹ
const HANGUL_CODA_W = '우';
const hangulBlock = (c, v, coda) => String.fromCharCode(0xAC00 +
  (HANGUL_L[c] * 21 + (c === W ? HANGUL_WV : HANGUL_V)[v]) * 28 + (coda === undefined ? 0 : HANGUL_T[coda]));

// One block per syllable; a closing consonant sits inside the block, so the tone mark
// follows the block. w is ㅇ with a w-vowel (와 웨 위 워), a closing w is a separate 우.
function hangul({ label, tones }) {
  return {
    label, caps: false, finishWord: w => w, reverse: [],
    syllable: (c, v) => hangulBlock(c, v),
    closed: (c, v, cl) => cl.c === W ? hangulBlock(c, v) + tones[cl.tone] + HANGUL_CODA_W
                                     : hangulBlock(c, v, cl.c) + tones[cl.tone],
    // Blocks are read before anything else, with the tone that follows moved back before the coda
    preprocess: str => str.replace(/([가-힣])([ˊˋˆ]?)/g, (_, block, tone) => {
      const n = block.charCodeAt(0) - 0xAC00, L = Math.floor(n / 588), V = Math.floor(n % 588 / 28), T = n % 28;
      const t = tone ? TONES[tones.indexOf(tone)] : '';
      if (block === HANGUL_CODA_W) return 'u' + t;
      const c = HANGUL_L.indexOf(L), v = (c === W ? HANGUL_WV : HANGUL_V).indexOf(V), coda = HANGUL_T.indexOf(T);
      if (c < 0 || v < 0 || (T && coda < 0)) return 'x';   // not one of our syllables
      return CONS[c] + VOW[v] + t + (T ? CONS[coda] : '');
    })
  };
}

const SPACING_TONES = ['', 'ˊ', 'ˋ', 'ˆ'];
export const SCRIPTS = {
  latin:    alphabet({ label: 'Latin', cons: CONS, vow: VOW, codaW: 'u' }),
  georgian: alphabet({ label: 'Georgian · ქართული', cons: ['ფ', 'თ', 'ვ', 'ს', 'მ', 'ნ', 'ლ', 'უ'], vow: ['ა', 'ე', 'ი', 'ო'], codaW: 'უ', caps: false }),
  greek:    alphabet({ label: 'Greek · Ελληνικά', cons: ['π', 'τ', 'β', 'σ', 'μ', 'ν', 'λ', 'ϝ'], vow: ['α', 'ε', 'ι', 'ο'], codaW: 'υ',
                       tones: ['', '́', '̀', '͂'], finishWord: w => w.replace(/σ$/, 'ς'), extraReverse: [['ς', 's']] }),
  cyrillic: alphabet({ label: 'Cyrillic · Кириллица', cons: ['п', 'т', 'в', 'с', 'м', 'н', 'л', 'ў'], vow: ['а', 'е', 'и', 'о'], codaW: 'ў' }),
  armenian: alphabet({ label: 'Armenian · Հայերեն', cons: ['պ', 'տ', 'վ', 'ս', 'մ', 'ն', 'լ', 'ւ'], vow: ['ա', 'է', 'ի', 'օ'], codaW: 'ւ' }),
  // Vowels are signs on the consonant (a is the long-aa sign, so nothing relies on the
  // inherent vowel); closing consonants take a virama and join the next one as a conjunct.
  // v and w share a letter, so w gets a nukta. Tones are Devanagari's Vedic-style accents.
  devanagari: alphabet({ label: 'Devanagari · देवनागरी', cons: ['प', 'त', 'व', 'स', 'म', 'न', 'ल', 'व़'],
                         vow: ['ा', 'े', 'ि', 'ो'], codaW: 'उ', halant: '्', caps: false,
                         tones: ['', '॔', '॓', '॑'] }),
  hangul:   hangul({ label: 'Hangul · 한글', tones: SPACING_TONES }),
  // Combining accents don't attach to Ethiopic syllables, so tones are spacing marks after them
  ethiopic: ethiopic({ label: "Ge'ez · ግዕዝ", rows: [0x1350, 0x1270, 0x1268, 0x1230, 0x1218, 0x1290, 0x1208, 0x12C8], tones: SPACING_TONES })
};

// ---------- Reading ----------
// Any script back to the Latin spelling the codec reads. Keys are decomposed, so letters
// like Cyrillic ў (у + breve) or Devanagari w (व + nukta) become multi-character keys.
const REVERSE = new Map(Object.values(SCRIPTS).filter(S => S !== SCRIPTS.latin)
  .flatMap(S => S.reverse).map(([k, v]) => [k.normalize('NFD'), v]));
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const REVERSE_SEQ = new RegExp([...REVERSE.keys()].filter(k => [...k].length > 1).map(escapeRe).join('|'), 'g');
function toLatin(str) {
  // Recompose first so Hangul arrives as whole blocks even if pasted as separate jamo
  let t = str.normalize('NFC');
  for (const S of Object.values(SCRIPTS)) if (S.preprocess) t = S.preprocess(t);
  t = t.toLowerCase().normalize('NFD').replace(REVERSE_SEQ, m => REVERSE.get(m));
  // Scripts that write w the same way in both positions: a u before a vowel starts a syllable
  return [...t].map(ch => REVERSE.get(ch) ?? ch).join('').replace(/u(?=[aeio])/g, 'w');
}

// A name in any script, full or nickname, back into a person
export function readName(str) {
  const words = str.trim().split(/\s+/);
  return decodeLatin(words.map(toLatin).join(' '), words);
}

// ---------- Writing ----------
const capitalise = (S, t) => S.caps ? t[0].toUpperCase() + t.slice(1) : t;
// A word's syllables as written, the first one capitalised
export const spellWord = (S, sy) => sy.map((s, i) => i === 0 ? capitalise(S, S.syllable(s.c, s.v)) : S.syllable(s.c, s.v));
export const fullName = (S, name) => PARTS.map(k => spellWord(S, name[k]).join('')).join(' ');
function nickWord(S, sy) {
  const out = nickSyllables(sy).map(s => s.closing ? S.closed(s.c, s.v, s.closing) : S.syllable(s.c, s.v)).join('');
  return S.finishWord(capitalise(S, out)).normalize('NFC');
}
export const nickname = (S, name) => PARTS.map(k => nickWord(S, name[k])).join(' ');
export const syllables = (S, sy) => sy.map(s => S.syllable(s.c, s.v));
