// The page: the form, the script picker, the reader, and the random starting person.
// Rendering uses lit-html: views are functions returning html`` templates, and render()
// patches only what changed. Anything inside ${} is inserted as text, never as HTML.
import { html, render, nothing } from 'https://cdn.jsdelivr.net/npm/lit-html@3.3.3/lit-html.js';
import {
  FIELDS, INDIVIDUAL, IS_CONSONANT, CONS, VOW, PARTS, EPOCH_YEAR, MAX_YEAR, LAT_CELLS, LON_CELLS, LON_FINE,
  LOCAL_MILES, FAMILY_MILES, toVowel, person, birthFromForm, encode, sameSyl, cellCentre
} from './codec.js';
import { SCRIPTS, readName, fullName, nickname, spellWord, syllables } from './scripts.js';
import { ipaFull, ipaNick, speak, canSpeak } from './speech.js';
import { pickMap, areaMap } from './map.js';

const $ = id => document.getElementById(id);
let script = SCRIPTS.latin;

// ---------- Small views ----------
const errorView = msg => html`<p class="err">${msg}</p>`;

const sayBtn = (name, text, nick) => canSpeak
  ? html`<button class="outline secondary say" title="Say it" aria-label="Say ${text}"
           @click=${() => speak(name, nick)}>🔊</button>`
  : nothing;

// A name and its 🔊 button, with the IPA underneath
const nameGroup = (line, name, text, nick, ipa) => html`
  <div class="stack name-group">
    <div class="cluster say-line">${line}${sayBtn(name, text, nick)}</div>
    <div class="ipa">${ipa}</div>
  </div>`;

// A name with the syllables that differ from `base` highlighted
const markedName = (name, base) => html`<span class="name-text">${PARTS.map((k, w) => html`${w ? ' ' : ''}${spellWord(script, name[k]).map((t, i) =>
  sameSyl(name[k][i], base[k][i]) ? t : html`<mark>${t}</mark>`)}`)}</span>`;

const selectView = id => html`
  <label>${FIELDS[id].label}
    <select id=${id}>${FIELDS[id].values.map((v, i) => html`<option value=${i}>${v}</option>`)}</select>
  </label>`;

// ---------- Form ----------
render(['sex', 'colour', 'align'].map(selectView), $('fieldsA'));
render(['chrono', 'spice', 'element'].map(selectView), $('fieldsB'));

function readBirth() {
  const traits = {};
  for (const id in FIELDS) traits[id] = +$(id).value;
  return birthFromForm(traits, $('year').value, $('lat').value, $('lon').value);
}

// ---------- Script picker ----------
render(Object.entries(SCRIPTS).map(([id, S]) => html`<option value=${id}>${S.label}</option>`), $('script'));
try { const saved = localStorage.getItem('script'); if (SCRIPTS[saved]) script = SCRIPTS[saved]; } catch (e) {}
$('script').value = Object.keys(SCRIPTS).find(id => SCRIPTS[id] === script);
$('script').addEventListener('change', () => {
  // Rewrite whatever is in the reader into the new script, keeping full name vs nickname
  let reading = null;
  try {
    const name = encode(readName($('nameIn').value));
    reading = { name, nick: $('nameIn').value.trim().normalize('NFC') === nickname(script, name) };
  } catch (err) {}
  script = SCRIPTS[$('script').value];
  try { localStorage.setItem('script', $('script').value); } catch (e) {}
  if (reading) $('nameIn').value = reading.nick ? nickname(script, reading.name) : fullName(script, reading.name);
  renderEncode();
  renderDecode();
});

// ---------- Random starting values ----------
// Cities to scatter random birthplaces around, so the pin lands on land
const CITIES = [
  [51.51, -0.13], [48.86, 2.35], [52.52, 13.40], [40.42, -3.70], [41.90, 12.50],
  [59.33, 18.07], [40.71, -74.01], [34.05, -118.24], [41.88, -87.63], [43.65, -79.38],
  [19.43, -99.13], [-23.55, -46.63], [-34.60, -58.38], [6.52, 3.38], [-1.29, 36.82],
  [30.04, 31.24], [-33.92, 18.42], [28.61, 77.21], [19.08, 72.88], [35.68, 139.69],
  [37.57, 126.98], [31.23, 121.47], [1.35, 103.82], [-6.21, 106.85], [-33.87, 151.21],
  [-36.85, 174.76], [55.76, 37.62], [41.01, 28.98], [25.20, 55.27], [64.15, -21.94]
];
const randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
function randomBirth() {
  const [cLat, cLon] = CITIES[randInt(0, CITIES.length - 1)];
  const year = randInt(EPOCH_YEAR, MAX_YEAR);
  const lat = Math.max(-90, Math.min(90, cLat + (Math.random() - 0.5) * 0.4));
  const lon = cLon + (Math.random() - 0.5) * 0.4;
  const traits = {};
  for (const id in FIELDS) traits[id] = randInt(0, FIELDS[id].values.length - 1);
  return { traits, year, lat, lon };
}
function fillForm(b) {
  for (const id in FIELDS) $(id).value = b.traits[id];
  $('year').value = b.year;
  $('lat').value = b.lat.toFixed(5);
  $('lon').value = b.lon.toFixed(5);
}
// A sibling: born in the same place a few years apart, with their own traits
function siblingOf(b) {
  const gap = randInt(1, 6) * (Math.random() < 0.5 ? -1 : 1);
  let year = b.year + gap;
  if (year < EPOCH_YEAR || year > MAX_YEAR) year = b.year - gap;
  return { ...randomBirth(), lat: b.lat, lon: b.lon, year };
}

// ---------- Remembered inputs ----------
// The form and the reader are kept in this browser only, so a refresh keeps them.
// Anything missing or out of range falls back to a fresh random person.
const SAVE_KEY = 'inputs';
function saveInputs() {
  const fields = {};
  for (const id of [...Object.keys(FIELDS), 'year', 'lat', 'lon', 'nameIn']) fields[id] = $(id).value;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(fields)); } catch (e) {}
}
function restoreInputs() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) {}
  if (!saved || typeof saved !== 'object') return false;
  const ok = Object.keys(FIELDS).every(id => Number.isInteger(+saved[id]) && +saved[id] >= 0 && +saved[id] < FIELDS[id].values.length)
    && [saved.year, saved.lat, saved.lon, saved.nameIn].every(v => typeof v === 'string')
    && isFinite(parseFloat(saved.lat)) && isFinite(parseFloat(saved.lon));
  if (!ok) return false;
  for (const id of [...Object.keys(FIELDS), 'year', 'lat', 'lon', 'nameIn']) $(id).value = saved[id];
  return true;
}

let start;
if (restoreInputs()) {
  start = { lat: parseFloat($('lat').value), lon: parseFloat($('lon').value) };
} else {
  start = randomBirth();
  fillForm(start);
  $('nameIn').value = fullName(script, encode(person(siblingOf(start))));
}

// ---------- Maps ----------
function setPick(lon, lat, fly) {
  $('lat').value = lat.toFixed(5);
  $('lon').value = lon.toFixed(5);
  picker.pin(lon, lat);
  if (fly) picker.flyTo(lon, lat);
  renderEncode();
}
const picker = pickMap('pickMap', [start.lon, start.lat], (lon, lat) => setPick(lon, lat, false));
const area = areaMap('showMap', [start.lon, start.lat]);

$('randomise').onclick = () => {
  const b = randomBirth();
  fillForm(b);
  $('nameIn').value = fullName(script, encode(person(siblingOf(b))));
  picker.pin(b.lon, b.lat);
  picker.flyTo(b.lon, b.lat);
  renderEncode();
  renderDecode();
};

// ---------- The made name ----------
function sendToReader(text) {
  $('nameIn').value = text;
  renderDecode();
  $('nameIn').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Nearby people, to show which syllables each kind of difference changes
function neighbours(x, cosLat) {
  const step = (id, by) => (x[id] + by) % FIELDS[id].values.length;
  return [
    { label: 'A sibling born 3 years later', person: { ...x, year: x.year + 3, colour: step('colour', 3), align: step('align', 5), element: step('element', 2) } },
    { label: 'Born a year earlier', person: { ...x, year: x.year - 1 } },
    { label: 'Likes the next colour along', person: { ...x, colour: step('colour', 1) } },
    { label: 'One step more chaotic', person: { ...x, align: step('align', 1) } },
    { label: 'Born ~6 miles further north', person: { ...x, la: Math.min(LAT_CELLS - 1, x.la + 1) } },
    { label: `Born ~${(LOCAL_MILES * cosLat).toFixed(1)} miles further east`, person: { ...x, lo: (x.lo + 1) % LON_CELLS } },
    { label: `Born ~${(FAMILY_MILES * cosLat).toFixed(0)} miles further east`, person: { ...x, lo: (x.lo + LON_FINE) % LON_CELLS } }
  ].filter(v => v.person.year >= EPOCH_YEAR && v.person.year <= MAX_YEAR);
}

function encodeView(birth) {
  const x = person(birth);
  const name = encode(x);
  const full = fullName(script, name), nick = nickname(script, name);
  const ind = syllables(script, name.individual);
  return html`<div class="stack result">
    ${nameGroup(html`<span class="name">${full}</span>`, name, full, false, ipaFull(name))}
    ${nameGroup(html`<span class="nick">or <b>${nick}</b> for short</span>`, name, nick, true, ipaNick(name))}
    <div class="cluster parts">
      <div class="part"><b>${ind[0]}</b>colour + chronotype</div>
      <div class="part"><b>${ind[1]}</b>alignment + spice</div>
      <div class="part"><b>${ind[2]}</b>element + sex</div>
      <div class="part"><b>${syllables(script, name.generation).join('-')}</b>birth year + local area</div>
      <div class="part"><b>${syllables(script, name.family).join('-')}</b>family area</div>
    </div>
    <div class="stack neigh">${neighbours(x, Math.cos(birth.lat * Math.PI / 180)).map(v =>
      html`<div class="with-sidebar"><span class="k">${v.label}:</span> ${markedName(encode(v.person), name)}</div>`)}</div>
    <div role="group">
      <button class="outline" id="toRead" @click=${() => sendToReader(full)}>Read this name ↓</button>
      <button class="outline secondary" id="toReadNick" @click=${() => sendToReader(nick)}>Read the nickname ↓</button>
    </div>
  </div>`;
}

function renderEncode() {
  saveInputs();
  let view;
  try { view = encodeView(readBirth()); } catch (err) { view = errorView(err.message); }
  render(view, $('result'));
}

// ---------- The reader ----------
function decodedView(r) {
  const { lat, lon } = cellCentre(r);
  const name = encode(r);
  const full = fullName(script, name), nick = nickname(script, name);
  return html`<div class="stack decoded">
    ${nameGroup(html`<span><b>Full name:</b> <span class="name-text">${full}</span></span>`, name, full, false, ipaFull(name))}
    ${nameGroup(html`<span><b>Nickname:</b> <span class="name-text">${nick}</span></span>`, name, nick, true, ipaNick(name))}
    ${Object.keys(FIELDS).map(id => html`<p><b>${FIELDS[id].label}:</b> ${FIELDS[id].values[r[id]]}</p>`)}
    <p><b>Born:</b> ${r.year}</p>
    <p><b>Birthplace:</b> around ${lat.toFixed(2)}, ${lon.toFixed(2)} (to within a few miles)</p>
  </div>`;
}

function renderDecode() {
  saveInputs();
  const text = $('nameIn').value;
  let view = nothing;
  if (text.trim()) {
    try {
      const r = readName(text);
      view = decodedView(r);
      area.show(r);
    } catch (err) {
      view = errorView(err.message);
    }
  }
  render(view, $('decoded'));
}

// ---------- The syllable guide ----------
// Which trait each individual-name sound carries, and each trait's sounds
function renderGuide() {
  const lower = id => FIELDS[id].label.toLowerCase();
  render(INDIVIDUAL.map(([c, v], i) =>
    html`<tr><td>${i === 0 ? 'Individual' : ''}</td><td>${i + 1}</td><td>${lower(c)}</td><td>${lower(v)}</td></tr>`), $('layoutIndividual'));
  const sound = (id, i) => IS_CONSONANT[id] ? (CONS[i] === 'r' ? 'l/r' : CONS[i]) : VOW[toVowel(id, i)];
  render(Object.keys(FIELDS).map(id => html`
    <p><small><b>${FIELDS[id].label}:</b> ${FIELDS[id].values.map((v, i) => html`${i ? ' · ' : ''}<i>${sound(id, i)}</i> ${v}`)}</small></p>`),
    $('key'));
}

// ---------- Wiring ----------
$('year').max = MAX_YEAR;
[...Object.keys(FIELDS), 'year', 'lat', 'lon'].forEach(id => $(id).addEventListener('input', renderEncode));
['lat', 'lon'].forEach(id => $(id).addEventListener('change', () => {
  const lat = parseFloat($('lat').value), lon = parseFloat($('lon').value);
  if (isFinite(lat) && isFinite(lon) && Math.abs(lat) <= 90) {
    picker.pin(lon, lat);
    picker.easeTo(lon, lat);
  }
}));
$('nameIn').addEventListener('input', renderDecode);

$('geo').onclick = () => {
  if (!navigator.geolocation) return alert('Location is not available in this browser.');
  navigator.geolocation.getCurrentPosition(
    p => setPick(p.coords.longitude, p.coords.latitude, true),
    () => alert('Could not get your location. You can type coordinates or click the map instead.')
  );
};

renderGuide();
renderEncode();
renderDecode();
