import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIELDS, PARTS, LAT_CELLS, LON_CELLS, encode, decodeLatin, birthFromForm, vowelShift, unusedVowel } from '../js/codec.js';
import { SCRIPTS, fullName, nickname } from '../js/scripts.js';
import { rng, randomPerson, LONDON } from './helpers.js';

const latin = SCRIPTS.latin;
const sounds = name => PARTS.flatMap(k => name[k].flatMap(s => [s.c, 100 + s.v]));
const soundsChanged = (a, b) => { const x = sounds(encode(a)), y = sounds(encode(b)); return x.filter((s, i) => s !== y[i]).length; };

test('the London example spells as documented', () => {
  assert.equal(fullName(latin, encode(LONDON)), 'Nevawo Sanu Lapurepe');
  assert.equal(nickname(latin, encode(LONDON)), 'Nevwo Sǎn Lǎplép');
});

test('full names and nicknames decode back to the same person', () => {
  const r = rng(1);
  for (let i = 0; i < 5000; i++) {
    const x = randomPerson(r);
    const name = encode(x);
    assert.deepEqual(decodeLatin(fullName(latin, name)), x);
    assert.deepEqual(decodeLatin(nickname(latin, name)), x);
  }
});

test('one step in any trait, the year or the grid changes exactly one sound, plus all three vowels across a 16-year boundary', () => {
  const r = rng(2);
  for (let i = 0; i < 3000; i++) {
    const x = randomPerson(r);
    const steps = [{ ...x, lo: (x.lo + 1) % LON_CELLS }];
    if (x.la < LAT_CELLS - 1) steps.push({ ...x, la: x.la + 1 });
    if (x.year < 2057) steps.push({ ...x, year: x.year + 1 });
    for (const id in FIELDS) steps.push({ ...x, [id]: (x[id] + 1) % FIELDS[id].values.length });
    for (const y of steps) {
      const crossed = vowelShift(x.year) !== vowelShift(y.year) ? 3 : 0;
      assert.equal(soundsChanged(x, y), 1 + crossed, JSON.stringify([x, y]));
    }
  }
});

test('malformed names are rejected with a reason', () => {
  assert.throws(() => decodeLatin('Nevawo Sanu'), /three parts/);
  assert.throws(() => decodeLatin('Nev Sanu Lapurepe'), /Expected 3 syllables/);
  assert.throws(() => decodeLatin('Nèvawo Sanu Lapurepe'), /tone mark needs a closing consonant/);
  assert.throws(() => decodeLatin('Xyzz Sanu Lapurepe'), /doesn't split into syllables/);
});

test('form input: an empty latitude asks for one, like an empty longitude', () => {
  const traits = { sex: 0, colour: 0, align: 0, chrono: 0, spice: 0, element: 0 };
  assert.throws(() => birthFromForm(traits, '1990', '', '10'), /^Error: Enter a latitude\.$/);
  assert.throws(() => birthFromForm(traits, '1990', '10', ''), /^Error: Enter a longitude\.$/);
  assert.throws(() => birthFromForm(traits, '1990', '95', '10'), /Latitude must be between -90 and 90/);
  assert.throws(() => birthFromForm(traits, '1900', '10', '10'), /Birth year must be between 1930/);
  assert.deepEqual(birthFromForm(traits, '1990', '51.5', '-0.12'), { traits, year: 1990, lat: 51.5, lon: -0.12 });
});

test('every 16 years the individual name\'s vowels move one step along a e i o u, and come round again after 80', () => {
  const ind = year => encode({ ...LONDON, year }).individual;
  const base = ind(1930);
  assert.deepEqual(ind(1945), base);
  assert.deepEqual(ind(1946), base.map(s => ({ c: s.c, v: (s.v + 1) % 5 })));
  assert.deepEqual(ind(1994), base.map(s => ({ c: s.c, v: (s.v + 4) % 5 })));
  assert.deepEqual(ind(2010), base);
});

test('each era leaves one vowel out of individual names, and generation and family names never use o', () => {
  assert.deepEqual([1930, 1946, 1962, 1978, 1994, 2010].map(unusedVowel), ['u', 'a', 'e', 'i', 'o', 'u']);
  const r = rng(8);
  for (let i = 0; i < 2000; i++) {
    const name = encode(randomPerson(r));
    for (const s of [...name.generation, ...name.family]) assert.notEqual(s.v, 3);
  }
  // London 1990 is in the era that leaves out i
  assert.throws(() => decodeLatin('Nevawi Sanu Lapurepe'), /"Nevawi" uses i, which individual names of people born 1978–1993 leave out/);
  assert.throws(() => decodeLatin('Nevawo Sanu Lapurepo'), /"Lapurepo": generation and family names only use the vowels a e i u/);
});

test('the liquid is written r between vowels and l everywhere else, and reads either way', () => {
  const r = rng(9);
  for (let i = 0; i < 3000; i++) {
    const x = randomPerson(r);
    const full = fullName(latin, encode(x)), nick = nickname(latin, encode(x)).normalize('NFD');
    // r only ever sits between two vowels; l never does
    assert.doesNotMatch(full.toLowerCase(), /(^|[^aeiou])r|r($|[^aeiou])|[aeiou]l[aeiou]/, full);
    assert.doesNotMatch(nick.toLowerCase(), /r/, nick);
    // Swapping every l and r still reads as the same person
    const swapped = full.replace(/[lLrR]/g, ch => ({ l: 'r', r: 'l', L: 'R', R: 'L' })[ch]);
    assert.deepEqual(decodeLatin(swapped), x, swapped);
  }
});
