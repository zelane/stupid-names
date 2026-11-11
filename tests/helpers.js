import { FIELDS, EPOCH_YEAR, LAT_CELLS, LON_CELLS, latIndex, lonIndex } from '../js/codec.js';

// Small seeded generator so failures reproduce
export function rng(seed = 1) {
  return n => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
}

// A random person over the whole encodable range (years run to 2057)
export function randomPerson(r) {
  const x = { year: EPOCH_YEAR + r(128), la: r(LAT_CELLS), lo: r(LON_CELLS) };
  for (const id in FIELDS) x[id] = r(FIELDS[id].values.length);
  return x;
}

// London, 1990, with fixed traits: the example used on the page
export const LONDON = { year: 1990, la: latIndex(51.5), lo: lonIndex(-0.12), sex: 1, colour: 5, align: 2, chrono: 3, spice: 2, element: 7 };
