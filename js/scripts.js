// Writing systems: spelling an encoded name in a script, and reading any script back.
import { CONS, VOW, W, R, TONES, PARTS, nickSyllables, decodeLatin } from './codec.js';

// Every script spells the same 8 consonants (p t v s m n r w) and 5 vowels (a e i o u) and
// provides: syllable(c, v, between); closed(c, v, closing) for a nickname syllable;
// finishWord(word); caps; and `reverse`, [its text, Latin] pairs for reading names back.
// `between` is whether the syllable follows a vowel, which writes the liquid as r rather than l.

// Tones other than the Latin combining accents, read back as those accents
const toneReverse = tones => tones.map((t, i) => [t, TONES[i]]).filter(([t, l]) => t && t !== l);

// Letters for consonants and vowels. codaW is how a w closing a nickname syllable is
// written, when that differs from a starting w; halant marks a consonant with no vowel of
// its own. Every script writes w with a letter of its own, never its letter for the vowel u:
// with one letter for both, a closing w then wu, and wu then a closing w, would look the same.
// liquidL is the script's l, for the liquid when it isn't between vowels.
function alphabet({ label, cons, liquidL, vow, codaW = cons[W], tones = TONES, halant = '', caps = true, finishWord = w => w, extraReverse = [] }) {
  const onset = (c, between) => c === R && !between ? liquidL : cons[c];
  const coda = c => c === W ? codaW : onset(c, false) + halant;
  const reverse = [
    ...cons.map((ch, c) => [ch, CONS[c]]), [liquidL, 'r'], ...vow.map((ch, v) => [ch, VOW[v]]),
    [codaW, 'w'], ...toneReverse(tones), ...(halant ? [[halant, '']] : []), ...extraReverse
  ];
  return {
    label, caps, finishWord, coda, reverse,
    syllable: (c, v, between) => onset(c, between) + vow[v],
    closed: (c, v, cl) => onset(c, false) + vow[v] + tones[cl.tone] + coda(cl.c)
  };
}

// Ethiopic writes each consonant-vowel pair as one character, in rows of seven forms
const ETHIOPIC_ORDER = [3, 4, 2, 6, 1];   // offsets of the a / e / i / o / u forms in each row
const ETHIOPIC_BARE = 5;               // offset of the form with no vowel
// liquidRow is the l row, for the liquid when it isn't between vowels
function ethiopic({ label, rows, liquidRow, tones }) {
  const row = (c, between) => c === R && !between ? liquidRow : rows[c];
  const ch = (c, off, between = false) => String.fromCodePoint(row(c, between) + off);
  const forms = (start, c) => [...ETHIOPIC_ORDER.map((off, v) => [String.fromCodePoint(start + off), CONS[c] + VOW[v]]),
                               [String.fromCodePoint(start + ETHIOPIC_BARE), CONS[c]]];
  return {
    label, caps: false, finishWord: w => w,
    syllable: (c, v, between) => ch(c, ETHIOPIC_ORDER[v], between),
    closed: (c, v, cl) => ch(c, ETHIOPIC_ORDER[v]) + tones[cl.tone] + ch(cl.c, ETHIOPIC_BARE),
    reverse: [...rows.flatMap((start, c) => forms(start, c)), ...forms(liquidRow, R), ...toneReverse(tones)]
  };
}

// Hangul jamo indices for composing blocks: 0xAC00 + (initial * 21 + vowel) * 28 + final
// ㄹ is Korean's one liquid, so it spells r
const HANGUL_L = [17, 16, 7, 9, 6, 2, 5, 11];        // ㅍ ㅌ ㅂ ㅅ ㅁ ㄴ ㄹ ㅇ
const HANGUL_V = [0, 5, 20, 8, 13], HANGUL_WV = [9, 15, 16, 14, 13];   // ㅏ ㅔ ㅣ ㅗ ㅜ, after w ㅘ ㅞ ㅟ ㅝ ㅜ (wu is 우)
const HANGUL_T = [26, 25, 17, 19, 16, 4, 8];         // finals ㅍ ㅌ ㅂ ㅅ ㅁ ㄴ ㄹ
// 우 is wu, so a closing w is 오, which is never a syllable of its own (wo is 워)
const HANGUL_CODA_W = '오';
const hangulBlock = (c, v, coda) => String.fromCharCode(0xAC00 +
  (HANGUL_L[c] * 21 + (c === W ? HANGUL_WV : HANGUL_V)[v]) * 28 + (coda === undefined ? 0 : HANGUL_T[coda]));

// One block per syllable; ㄹ already covers both l and r. A closing consonant sits inside the block, so the tone mark
// follows the block. w is ㅇ with a w-vowel (와 웨 위 워 우), a closing w is a separate 오.
function hangul({ label, tones }) {
  return {
    label, caps: false, finishWord: w => w, reverse: [],
    syllable: (c, v) => hangulBlock(c, v),
    closed: (c, v, cl) => cl.c === W ? hangulBlock(c, v) + tones[cl.tone] + HANGUL_CODA_W
                                     : hangulBlock(c, v, cl.c) + tones[cl.tone],
    // Blocks are read before anything else, with the tone that follows moved back before the coda
    preprocess: str => str.replace(/([가-힣])([ˊˋˆˇ]?)/g, (_, block, tone) => {
      const n = block.charCodeAt(0) - 0xAC00, L = Math.floor(n / 588), V = Math.floor(n % 588 / 28), T = n % 28;
      const t = tone ? TONES[tones.indexOf(tone)] : '';
      if (block === HANGUL_CODA_W) return 'w' + t;
      const c = HANGUL_L.indexOf(L), v = (c === W ? HANGUL_WV : HANGUL_V).indexOf(V), coda = HANGUL_T.indexOf(T);
      if (c < 0 || v < 0 || (T && coda < 0)) return 'x';   // not one of our syllables
      return CONS[c] + VOW[v] + t + (T ? CONS[coda] : '');
    })
  };
}

const SPACING_TONES = ['', 'ˊ', 'ˋ', 'ˆ', 'ˇ'];
export const SCRIPTS = {
  latin:    alphabet({ label: 'Latin', cons: CONS, liquidL: 'l', vow: VOW }),
  // Georgian's u letter can't double as w, so w is ჳ, the letter Mingrelian and Svan use for it
  georgian: alphabet({ label: 'Georgian · ქართული', cons: ['ფ', 'თ', 'ვ', 'ს', 'მ', 'ნ', 'რ', 'ჳ'], liquidL: 'ლ', vow: ['ა', 'ე', 'ი', 'ო', 'უ'], caps: false }),
  // u is the digraph ου, as in Greek itself, so a closing w is ϝ like a starting one (ο then υ would read as u).
  // Greek has no caron, so the fifth tone is a macron.
  greek:    alphabet({ label: 'Greek · Ελληνικά', cons: ['π', 'τ', 'β', 'σ', 'μ', 'ν', 'ρ', 'ϝ'], liquidL: 'λ', vow: ['α', 'ε', 'ι', 'ο', 'ου'],
                       tones: ['', '́', '̀', '͂', '̄'], finishWord: w => w.replace(/σ$/, 'ς'), extraReverse: [['ς', 's']] }),
  cyrillic: alphabet({ label: 'Cyrillic · Кириллица', cons: ['п', 'т', 'в', 'с', 'м', 'н', 'р', 'ў'], liquidL: 'л', vow: ['а', 'е', 'и', 'о', 'у'] }),
  // u is the digraph ու, as in Armenian itself, and w is ւ
  armenian: alphabet({ label: 'Armenian · Հայերեն', cons: ['պ', 'տ', 'վ', 'ս', 'մ', 'ն', 'ր', 'ւ'], liquidL: 'լ', vow: ['ա', 'է', 'ի', 'օ', 'ու'] }),
  // Vowels are signs on the consonant (a is the long-aa sign, so nothing relies on the
  // inherent vowel); closing consonants take a virama and join the next one as a conjunct.
  // v and w share a letter, so w gets a nukta, and a closing w is the full letter उ, distinct
  // from the u sign ु. Tones are Devanagari's Vedic-style accents.
  devanagari: alphabet({ label: 'Devanagari · देवनागरी', cons: ['प', 'त', 'व', 'स', 'म', 'न', 'र', 'व़'], liquidL: 'ल',
                         vow: ['ा', 'े', 'ि', 'ो', 'ु'], codaW: 'उ', halant: '्', caps: false,
                         tones: ['', '॔', '॓', '॑', '॒'] }),
  hangul:   hangul({ label: 'Hangul · 한글', tones: SPACING_TONES }),
  // Combining accents don't attach to Ethiopic syllables, so tones are spacing marks after them
  ethiopic: ethiopic({ label: "Ge'ez · ግዕዝ", rows: [0x1350, 0x1270, 0x1268, 0x1230, 0x1218, 0x1290, 0x1228, 0x12C8], liquidRow: 0x1208, tones: SPACING_TONES })
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
  return [...t].map(ch => REVERSE.get(ch) ?? ch).join('');
}

// A name in any script, full or nickname, back into a person
export function readName(str) {
  const words = str.trim().split(/\s+/);
  return decodeLatin(words.map(toLatin).join(' '), words);
}

// ---------- Writing ----------
const capitalise = (S, t) => S.caps ? t[0].toUpperCase() + t.slice(1) : t;
// A word's syllables as written, the first one capitalised
// In a full name every syllable after the first follows a vowel
export const spellWord = (S, sy) => sy.map((s, i) => i === 0 ? capitalise(S, S.syllable(s.c, s.v, false)) : S.syllable(s.c, s.v, true));
export const fullName = (S, name) => PARTS.map(k => spellWord(S, name[k]).join('')).join(' ');
function nickWord(S, sy) {
  const out = nickSyllables(sy).map(s => s.closing ? S.closed(s.c, s.v, s.closing) : S.syllable(s.c, s.v)).join('');
  return S.finishWord(capitalise(S, out)).normalize('NFC');
}
export const nickname = (S, name) => PARTS.map(k => nickWord(S, name[k])).join(' ');
export const syllables = (S, sy) => sy.map((s, i) => S.syllable(s.c, s.v, i > 0));
