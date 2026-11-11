# Birth Name Encoder

A static page that turns a few facts about a person (some chosen traits, birth year and
a birthplace to within a few miles) into a made-up three-part name, a shorter nickname,
and back again, in any of eight writing systems.

## Running it

The page uses ES modules, which browsers won't load from `file://`, so serve the folder:

```sh
python3 -m http.server 8000   # or: npm run serve
```

then open <http://localhost:8000>.

## Layout

| File | What it does |
|---|---|
| `index.html`, `style.css` | Markup and styling |
| `js/codec.js` | The scheme itself: traits, digit layouts, Gray code, a vowel shift by era, encoding a person as syllables and decoding Latin spellings back. No DOM. |
| `js/scripts.js` | Writing systems: spelling a name in each script, and reading any script back via Latin |
| `js/speech.js` | IPA transcriptions and the browser's built-in voices |
| `js/map.js` | The birthplace picker and the family-area map (MapLibre) |
| `js/app.js` | The page: form, script picker, reader, random starting person. Rendered with [lit-html](https://lit.dev/docs/libraries/standalone-templates/): each view is a function returning an `html` template, and `render()` patches only what changed. |

The only dependencies are loaded from CDNs at pinned versions: Pico CSS, MapLibre GL and
lit-html. `codec.js` and `scripts.js` don't use any of them, so the tests run in plain Node.

## Tests

```sh
npm test   # node --test, no dependencies
```

They cover round trips through every script, one-step-one-sound changes, and the
documented examples.
