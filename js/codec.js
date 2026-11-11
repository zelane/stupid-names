// The name scheme itself: traits, digit layouts, Gray code, and turning a person into
// syllables and back. Pure: no DOM, and only the Latin spelling (other scripts are in scripts.js).

export const CONS = ['p', 't', 'v', 's', 'm', 'n', 'l', 'w'];
export const VOW = ['a', 'e', 'i', 'o'];
export const W = CONS.indexOf('w');
export const EPOCH_YEAR = 1930;
export const MAX_YEAR = new Date().getFullYear();

// Traits in the individual name. Consonant fields have 8 values, vowel fields 4.
// `vowels` remaps a field's values onto a e i o when the default order isn't wanted.
export const FIELDS = {
  sex:     { label: 'Sex', values: ['Unspecified', 'Female', 'Male', 'Other'], vowels: [1, 0, 3, 2] },
  colour:  { label: 'Favourite colour', values: ['Red', 'Orange', 'Yellow', 'Green', 'Teal', 'Blue', 'Purple', 'Pink'] },
  align:   { label: 'Alignment', values: ['Lawful good', 'Neutral good', 'Chaotic good', 'Chaotic neutral',
                                          'Chaotic evil', 'Neutral evil', 'Lawful evil', 'Lawful neutral'] },
  chrono:  { label: 'Chronotype', values: ['Early bird', 'Morning', 'Evening', 'Night owl'] },
  spice:   { label: 'Spice tolerance', values: ['None', 'Mild', 'Hot', 'Inferno'] },
  element: { label: 'Element', values: ['Fire', 'Lightning', 'Air', 'Water', 'Ice', 'Earth', 'Metal', 'Void'] }
};
// [consonant field, vowel field] for each individual-name syllable; sex ends the name
export const INDIVIDUAL = [['colour', 'chrono'], ['align', 'spice'], ['element', 'sex']];
// Whether each trait is spelled by a consonant or a vowel
export const IS_CONSONANT = Object.fromEntries(INDIVIDUAL.flatMap(([c, v]) => [[c, true], [v, false]]));
export const toVowel = (f, v) => FIELDS[f].vowels ? FIELDS[f].vowels[v] : v;
const fromVowel = (f, i) => FIELDS[f].vowels ? FIELDS[f].vowels.indexOf(i) : i;

// Digit layouts. Latitude and longitude alternate between consonant (8) and vowel (4)
// slots across the family name, and their last digits sit in the generation name.
const LAT_RADIX = [8, 4, 8, 4, 2];   // 11 bits, ~6 mile rows
const LON_RADIX = [4, 8, 4, 8, 4];   // 12 bits
const YEAR_RADIX = [8, 4, 4];        // 7 bits, 1930-2057
export const LAT_CELLS = 2048, LON_CELLS = 4096;
// The last latitude and longitude digits share one generation-name consonant
const LAT_FINE = LAT_RADIX.at(-1);
export const LON_FINE = LON_RADIX.at(-1);
// East-west width of a local square and a family area at the equator, in miles
export const LOCAL_MILES = 6.1, FAMILY_MILES = 24.3;

function digitsOf(n, radix) {
  const d = [];
  for (let i = radix.length - 1; i >= 0; i--) { d[i] = n % radix[i]; n = Math.floor(n / radix[i]); }
  return d;
}
const fromDigits = (d, radix) => d.reduce((n, x, i) => n * radix[i] + x, 0);

// Reflected mixed-radix Gray code: a digit is reversed when the number formed by
// the digits before it is odd, so counting up changes exactly one digit at a time.
function toGray(d, radix) {
  let odd = false;
  return d.map((x, i) => {
    const g = odd ? radix[i] - 1 - x : x;
    odd = (odd * radix[i] + x) % 2 === 1;
    return g;
  });
}
function fromGray(g, radix) {
  let odd = false;
  return g.map((x, i) => {
    const d = odd ? radix[i] - 1 - x : x;
    odd = (odd * radix[i] + d) % 2 === 1;
    return d;
  });
}

export const latIndex = lat => Math.min(LAT_CELLS - 1, Math.max(0, Math.floor((lat + 90) / 180 * LAT_CELLS)));
export function lonIndex(lon) {
  const x = ((lon + 180) % 360 + 360) % 360;
  return Math.floor(x / 360 * LON_CELLS) % LON_CELLS;
}

// A birth is { traits, year, lat, lon }; a person is the traits plus year and grid cell,
// which is everything a name encodes
export const person = b => ({ ...b.traits, year: b.year, la: latIndex(b.lat), lo: lonIndex(b.lon) });

// A birth from the form's text fields, or an error saying what to fix
export function birthFromForm(traits, yearText, latText, lonText) {
  const year = +yearText, lat = parseFloat(latText), lon = parseFloat(lonText);
  if (!Number.isInteger(year) || year < EPOCH_YEAR || year > MAX_YEAR)
    throw new Error(`Birth year must be between ${EPOCH_YEAR} and ${MAX_YEAR}.`);
  if (latText.trim() === '') throw new Error('Enter a latitude.');
  if (!isFinite(lat) || lat < -90 || lat > 90) throw new Error('Latitude must be between -90 and 90.');
  if (!isFinite(lon)) throw new Error('Enter a longitude.');
  return { traits, year, lat, lon };
}

// Grid squares as [west, south, east, north]
function cellBox(la, lo, latCells, lonCells) {
  return [lo / lonCells * 360 - 180, la / latCells * 180 - 90, (lo + 1) / lonCells * 360 - 180, (la + 1) / latCells * 180 - 90];
}
export const familyBox = x => cellBox(Math.floor(x.la / LAT_FINE), Math.floor(x.lo / LON_FINE), LAT_CELLS / LAT_FINE, LON_CELLS / LON_FINE);
export const localBox = x => cellBox(x.la, x.lo, LAT_CELLS, LON_CELLS);
export const cellCentre = x => ({ lat: (x.la + 0.5) / LAT_CELLS * 180 - 90, lon: (x.lo + 0.5) / LON_CELLS * 360 - 180 });

// A syllable is a consonant and a vowel index; a name is three words of syllables
const syl = (c, v) => ({ c, v });
export const sameSyl = (a, b) => a.c === b.c && a.v === b.v;
export const PARTS = ['individual', 'generation', 'family'];

export function encode(x) {
  const la = toGray(digitsOf(x.la, LAT_RADIX), LAT_RADIX);
  const lo = toGray(digitsOf(x.lo, LON_RADIX), LON_RADIX);
  const yr = toGray(digitsOf(x.year - EPOCH_YEAR, YEAR_RADIX), YEAR_RADIX);
  return {
    individual: INDIVIDUAL.map(([c, v]) => syl(x[c], toVowel(v, x[v]))),
    generation: [syl(yr[0], yr[1]), syl(la[4] * LON_FINE + lo[4], yr[2])],
    // Finer half first, regional half last, so a region shows up as a shared ending
    family: [syl(la[2], lo[2]), syl(lo[3], la[3]), syl(la[0], lo[0]), syl(lo[1], la[1])]
  };
}

// Reads a name spelled in Latin letters, full or nickname or a mix, back into a person.
// `shown` is the words as the reader typed them, for error messages.
export function decodeLatin(str, shown) {
  const words = str.trim().split(/\s+/);
  if (words.length !== 3) throw new Error('A name has three parts: individual name, generation name and family name.');
  const [ind, gen, fam] = words.map((w, i) => parseWord(w, shown ? shown[i] : w));
  if (ind.length !== 3 || gen.length !== 2 || fam.length !== 4)
    throw new Error('Expected 3 syllables in the individual name, 2 in the generation name and 4 in the family name.');
  const x = {};
  INDIVIDUAL.forEach(([c, v], i) => { x[c] = ind[i].c; x[v] = fromVowel(v, ind[i].v); });
  const la = [fam[2].c, fam[3].v, fam[0].c, fam[1].v, Math.floor(gen[1].c / LON_FINE)];
  const lo = [fam[2].v, fam[3].c, fam[0].v, fam[1].c, gen[1].c % LON_FINE];
  x.la = fromDigits(fromGray(la, LAT_RADIX), LAT_RADIX);
  x.lo = fromDigits(fromGray(lo, LON_RADIX), LON_RADIX);
  x.year = EPOCH_YEAR + fromDigits(fromGray([gen[0].c, gen[0].v, gen[1].v], YEAR_RADIX), YEAR_RADIX);
  return x;
}

// Nickname tones: combining marks standing in for a lost a / e / i / o
export const TONES = ['', '́', '̀', '̂'];

// Pair up syllables: the second of each pair keeps only its consonant, which closes the
// first, and its vowel becomes the first's tone. Open syllables have no `closing`.
export function nickSyllables(sy) {
  const out = [];
  for (let i = 0; i < sy.length; i += 2) {
    const next = sy[i + 1];
    out.push(next ? { ...sy[i], closing: { c: next.c, tone: next.v } } : sy[i]);
  }
  return out;
}

// Reads full-name syllables (CV) and nickname syllables (CV + tone + C) alike,
// expanding each closed syllable back into the two it came from
function parseWord(word, shown) {
  const w = word.normalize('NFD').toLowerCase().replace(/[^a-z̀-̂]/g, '');
  const isCons = ch => CONS.includes(ch), isVow = ch => VOW.includes(ch);
  const out = [];
  let i = 0;
  while (i < w.length) {
    const c = CONS.indexOf(w[i]), v = VOW.indexOf(w[i + 1]);
    if (c < 0 || v < 0) throw new Error(`"${shown}" doesn't split into syllables: each one is a consonant (${CONS.join(' ')}) then a vowel (${VOW.join(' ')}).`);
    i += 2;
    let tone = TONES.indexOf(w[i]);
    if (tone > 0) i++; else tone = 0;
    if (w[i] === 'u' || (isCons(w[i]) && !isVow(w[i + 1]))) {
      out.push(syl(c, v), syl(CONS.indexOf(w[i] === 'u' ? 'w' : w[i]), tone));
      i++;
    } else if (tone > 0) {
      throw new Error(`"${shown}": a tone mark needs a closing consonant after its vowel.`);
    } else {
      out.push(syl(c, v));
    }
  }
  return out;
}
