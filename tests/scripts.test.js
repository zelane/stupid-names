import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encode } from '../js/codec.js';
import { SCRIPTS, readName, fullName, nickname } from '../js/scripts.js';
import { rng, randomPerson, LONDON } from './helpers.js';

test('every script round-trips full names and nicknames, in any case or normalisation', () => {
  for (const [id, S] of Object.entries(SCRIPTS)) {
    const r = rng(3);
    for (let i = 0; i < 2000; i++) {
      const x = randomPerson(r);
      const name = encode(x);
      for (const text of [fullName(S, name), nickname(S, name), nickname(S, name).toUpperCase(), nickname(S, name).normalize('NFD')])
        assert.deepEqual(readName(text), x, `${id}: ${text}`);
    }
  }
});

test('mixed full and nickname words read the same', () => {
  const name = encode(LONDON);
  const full = fullName(SCRIPTS.latin, name).split(' '), nick = nickname(SCRIPTS.latin, name).split(' ');
  assert.deepEqual(readName([full[0], nick[1], full[2]].join(' ')), LONDON);
});

test('w is never written with a script\'s letter for u or o, so w-heavy names still read', () => {
  // Every consonant w, with every vowel value, in every era: w beside each vowel in turn
  for (let year = 1930; year < 2010; year += 16)
    for (let v = 0; v < 4; v++) {
      const x = { ...LONDON, year, colour: 7, align: 7, element: 7, chrono: v, spice: (v + 1) % 4, sex: (v + 2) % 4 };
      for (const [id, S] of Object.entries(SCRIPTS))
        for (const text of [fullName(S, encode(x)), nickname(S, encode(x))])
          assert.deepEqual(readName(text), x, `${id}: ${text}`);
    }
});

test('each script spells the London example as expected', () => {
  const name = encode(LONDON);
  const expected = {
    georgian: ['ნევაჳო სანუ ლაფურეფე', 'ნევჳო სა̌ნ ლა̌ფლე́ფ'],
    greek: ['Νεβαϝο Σανου Λαπουρεπε', 'Νεβϝο Σᾱν Λᾱπλέπ'],
    hangul: ['네바워 사누 라푸레페', '넵워 산ˇ 랖ˇ렢ˊ'],
    ethiopic: ['ኔቫዎ ሳኑ ላፑሬፔ', 'ኔቭዎ ሳˇን ላˇፕሌˊፕ']
  };
  for (const [id, [full, nick]] of Object.entries(expected)) {
    assert.equal(fullName(SCRIPTS[id], name), full, id);
    assert.equal(nickname(SCRIPTS[id], name), nick.normalize('NFC'), id);
  }
});

test('Hangul blocks that are not our syllables are rejected', () => {
  assert.throws(() => readName('가나다 사누 라푸레페'), /doesn't split into syllables/);
});

test('decoding errors quote the word as it was typed, not its Latin reading', () => {
  assert.throws(() => readName('가나다 사누 라푸레페'), /"가나다"/);
  assert.throws(() => readName('Xyzz Sanu Lapurepe'), /"Xyzz"/);
  assert.throws(() => readName('Nèvawo Sanu Lapurepe'), /"Nèvawo"/);
});
