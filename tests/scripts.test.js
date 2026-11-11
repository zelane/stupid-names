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

test('a closing w is written u, and the older w spelling still reads', () => {
  const x = { ...LONDON, colour: 7, chrono: 0, align: 7, spice: 1 };   // first syllables wa·we
  const nick = nickname(SCRIPTS.latin, encode(x));
  assert.match(nick, /^Wáu/);
  assert.deepEqual(readName(nick.replace('Wáu', 'Wáw')), x);
});

test('each script spells the London example as expected', () => {
  const name = encode(LONDON);
  const expected = {
    georgian: ['ნოვიუა სანო ლაფოლეფე', 'ნო̀ვუა სა̂ნ ლა̂ფლე́ფ'],
    greek: ['Νοβιϝα Σανο Λαπολεπε', 'Νὸβϝα Σᾶν Λᾶπλέπ'],
    hangul: ['노비와 사노 라포레페', '놉ˋ와 산ˆ 랖ˆ렢ˊ'],
    ethiopic: ['ኖቪዋ ሳኖ ላፖሌፔ', 'ኖˋቭዋ ሳˆን ላˆፕሌˊፕ']
  };
  for (const [id, [full, nick]] of Object.entries(expected)) {
    assert.equal(fullName(SCRIPTS[id], name), full, id);
    assert.equal(nickname(SCRIPTS[id], name), nick.normalize('NFC'), id);
  }
});

test('Hangul blocks that are not our syllables are rejected', () => {
  assert.throws(() => readName('가나다 사노 라포레페'), /doesn't split into syllables/);
});

test('decoding errors quote the word as it was typed, not its Latin reading', () => {
  assert.throws(() => readName('가나다 사노 라포레페'), /"가나다"/);
  assert.throws(() => readName('Xyzz Sano Lapolepe'), /"Xyzz"/);
  assert.throws(() => readName('Nòviwa Sano Lapolepe'), /"Nòviwa"/);
});
