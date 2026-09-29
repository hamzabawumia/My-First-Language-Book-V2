# Data structure

Concept IDs (`001`–`200`) are the single source of truth.

- `images/001.jpg` – the picture (shared by all languages)
- `data/concepts.json` – the English concept for each ID (shared)
- `languages/<code>/` – one self-contained folder per language (see below)

## Language packs

```
languages/
  fr/
    pack.json          words + metadata
    audio/001.mp3 …    optional recordings
  es/
    pack.json
    audio/…
```

`pack.json`:

```json
{
  "language": "fr",          // must equal the folder name
  "name": "Français",        // shown in the picker
  "englishName": "French",   // used in button/labels
  "voiceLocale": "fr-FR",    // browser voice used when an mp3 is missing
  "sortOrder": 1,            // optional; lower = listed first / default
  "translations": { "001": { "word": "bébé" }, "002": { "word": "mère" } }
}
```

Audio is found by convention: `languages/<code>/audio/<ID>.mp3`.

## Adding / moving a language

1. Copy the pack folder into `languages/` (e.g. `languages/de/`).
2. Run `python3 tools/build.py`.
3. Reload (hard refresh the first time).

`tools/build.py` validates every pack and regenerates `languages/index.json`, `data/embedded.js` and the service-worker file list. A browser cannot list folders on its own, which is why this step exists. To remove a language, delete its folder and run the script again.

A pack only works with an app whose concept IDs match (same `data/concepts.json` order).
