# My First Language Book

A picture book for young children that teaches vocabulary in **any language**. The child sees a large picture, the word in the target language, and can tap 🔊 to hear it spoken. The same pictures are used for every language; only the words and audio change.

**Live site:** [https://hamzabawumia.github.io/My-First-Language-Book/](https://hamzabawumia.github.io/My-First-Language-Book-V2/)

- Installable and works offline (Progressive Web App)
- No framework, no build tools, no server — plain HTML, CSS and JavaScript
- Language packs are self-contained folders you can copy between installs

**Languages included:** French (`fr`, with recorded audio) and Spanish (`es`, words only; uses the browser's built-in voice until recordings are added).

> Developers: read **[DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)** before making changes. It explains how the app is structured, the data flow, and the rules that keep it from breaking.

---

## Run it locally

**Quick look:** double-click `index.html`. Navigation and audio work. (Browsers block file loading from local pages, so the app automatically uses the built-in copy of the data in `data/embedded.js`. Offline install does not work this way.)

**Full testing, including offline/PWA behavior:** serve the folder over HTTP:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

---

## How it works, in one minute

Every picture has a permanent three-digit **concept ID** (`001`–`200`). That ID links everything together:

```text
ID 003 = dog

images/003.jpg                    the picture
data/concepts.json                "003" → English "dog"
languages/fr/pack.json            "003" → "chien"
languages/fr/audio/003.mp3        French recording
languages/es/pack.json            "003" → "perro"
languages/es/audio/003.mp3        Spanish recording (optional)
```

The ID is also the picture's position in the book. **Never renumber or reorder concepts** — always add new ones at the end.

---

## Project structure

```text
index.html                 The single page (cover, reader, "For parents")
app.js                     Application logic
styles.css                 Styling
sw.js                      Service worker (offline cache) — top block is generated
manifest.webmanifest       PWA settings

data/
  concepts.json            The 200 concepts, shared by all languages
  embedded.js              GENERATED — offline copy of the data

images/                    001.jpg … (one picture per concept ID; .jpg or .png)

languages/
  index.json               GENERATED — list of language folders
  fr/
    pack.json              French words and settings
    audio/001.mp3 …        French recordings
  es/
    pack.json
    audio/                 (empty — browser voice is used)

tools/build.py             Validates packs and regenerates the generated files
```

Files marked **GENERATED** are created by `tools/build.py`. Don't edit them by hand.

---

## Add a language

1. Copy an existing pack folder in `languages/` (for example `es` → `de`).
2. Edit `languages/de/pack.json`: set `language` (must match the folder name), `name`, `englishName`, `voiceLocale`, and translate all 200 words.
3. Optional: add recordings as `languages/de/audio/001.mp3` … `200.mp3`. Any missing recording falls back to the browser voice.
4. Run the build script:

   ```bash
   python3 tools/build.py
   ```

   It checks the pack, prints a coverage report, and updates the generated files. If it reports problems, fix them and run it again.
5. Reload the app (hard refresh the first time).

To move a language to another install of the app, copy its folder into that install's `languages/` folder and run `python3 tools/build.py` there. Both installs must use the same `concepts.json`.

`pack.json` format:

```json
{
  "language": "fr",
  "name": "Français",
  "englishName": "French",
  "voiceLocale": "fr-FR",
  "sortOrder": 1,
  "translations": {
    "001": { "word": "bébé" },
    "002": { "word": "mère" }
  }
}
```

The first language (lowest `sortOrder`) is the default for new visitors. The app remembers each visitor's last choice.

---

## Add or replace pictures

Save the picture in `images/` named with its concept ID:

```text
images/001.jpg
images/002.png
images/003.jpg
```

- JPG and PNG both work; JPG is used first if both exist.
- Use clear, high-resolution images with the subject large and easy for a young child to recognise.
- If a picture is missing, the app shows the emoji from `concepts.json` instead, so you can replace pictures gradually. Right now only **001–010** have real photographs; **011–200** show emoji placeholders.

Run `python3 tools/build.py` afterwards. See `02. ADDING_IMAGES.md` for detailed guidance for artists.

> Replacing a picture or recording with a new file of the *same name* may not show on devices that already saved the old one until their site data is cleared. See "Known gotchas" in the developer guide.

---

## Add more concepts (201 and beyond)

1. Append the new entry to `data/concepts.json` with the next ID.
2. Add its word to **every** `languages/*/pack.json`.
3. Add `images/201.jpg` (and audio if you have it).
4. Run `python3 tools/build.py`.

The build script fails if any language is missing the new word.

---

## Publish on GitHub Pages

1. Run `python3 tools/build.py` and check that it ends with `OK`.
2. Commit your changes, **including the generated files** (`languages/index.json`, `data/embedded.js`, `sw.js`).
3. In GitHub: **Settings → Pages → Deploy from a branch**, choose your main branch and `/ (root)`.
4. Open the published URL. Pages serves the app over HTTPS, which is required for offline install.

If a change doesn't appear, hard-refresh or clear the site's data — the browser may be holding an older cached copy.

---

## Documentation

| File | What it's for |
|---|---|
| `README.md` | This overview |
| `DEVELOPER_GUIDE.md` | Architecture, data flow, safe-change rules, gotchas, testing, troubleshooting |
| `DATA_STRUCTURE.md` | Short reference for the data formats |
| `02. ADDING_IMAGES.md` | Guide for adding and replacing artwork |

## Planned improvements

- A consistent, complete illustration set for concepts 011–200
- Category browsing
- Optional parent-recorded narration
- Right-to-left language support
- EPUB/PDF export
