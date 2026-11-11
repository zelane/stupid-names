import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIELDS, PARTS, LAT_CELLS, LON_CELLS, encode, decodeLatin, birthFromForm } from '../js/codec.js';
import { SCRIPTS, fullName, nickname } from '../js/scripts.js';
import { rng, randomPerson, LONDON } from './helpers.js';

const latin = SCRIPTS.latin;
const sounds = name => PARTS.flatMap(k => name[k].flatMap(s => [s.c, 100 + s.v]));
const soundsChanged = (a, b) => { const x = sounds(encode(a)), y = sounds(encode(b)); return x.filter((s, i) => s !== y[i]).length; };

test('the London example spells as documented', () => {
  assert.equal(fullName(latin, encode(LONDON)), 'Noviwa Sano Lapolepe');
  assert.equal(nickname(latin, encode(LONDON)), 'Nòvwa Sân Lâplép');
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

test('one step in any trait, the year or the grid changes exactly one sound', () => {
  const r = rng(2);
  for (let i = 0; i < 3000; i++) {
    const x = randomPerson(r);
    const steps = [{ ...x, lo: (x.lo + 1) % LON_CELLS }];
    if (x.la < LAT_CELLS - 1) steps.push({ ...x, la: x.la + 1 });
    if (x.year < 2057) steps.push({ ...x, year: x.year + 1 });
    for (const id in FIELDS) steps.push({ ...x, [id]: (x[id] + 1) % FIELDS[id].values.length });
    for (const y of steps) assert.equal(soundsChanged(x, y), 1, JSON.stringify([x, y]));
  }
});

test('malformed names are rejected with a reason', () => {
  assert.throws(() => decodeLatin('Noviwa Sano'), /three parts/);
  assert.throws(() => decodeLatin('Nov Sano Lapolepe'), /Expected 3 syllables/);
  assert.throws(() => decodeLatin('Nòviwa Sano Lapolepe'), /tone mark needs a closing consonant/);
  assert.throws(() => decodeLatin('Xyzz Sano Lapolepe'), /doesn't split into syllables/);
});

test('form input: an empty latitude asks for one, like an empty longitude', () => {
  const traits = { sex: 0, colour: 0, align: 0, chrono: 0, spice: 0, element: 0 };
  assert.throws(() => birthFromForm(traits, '1990', '', '10'), /^Error: Enter a latitude\.$/);
  assert.throws(() => birthFromForm(traits, '1990', '10', ''), /^Error: Enter a longitude\.$/);
  assert.throws(() => birthFromForm(traits, '1990', '95', '10'), /Latitude must be between -90 and 90/);
  assert.throws(() => birthFromForm(traits, '1900', '10', '10'), /Birth year must be between 1930/);
  assert.deepEqual(birthFromForm(traits, '1990', '51.5', '-0.12'), { traits, year: 1990, lat: 51.5, lon: -0.12 });
});
