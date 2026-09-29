# My First Language Book

A language-neutral picture book PWA for young children.

## Run locally

You can open `index.html` directly from your desktop for a quick test. The app includes an embedded vocabulary fallback, so navigation works even when the browser blocks local file requests.

For full PWA/offline installation testing, serve it from a local web server. If you have Python installed:

```bash
python3 -m http.server 8000
```

Then open:

http://localhost:8000

## Publish on GitHub Pages

1. Create a GitHub repository.
2. Upload the contents of this folder to the repository root.
3. In GitHub, open **Settings → Pages**.
4. Choose **Deploy from a branch**.
5. Select your main branch and `/ (root)`.
6. Save.

GitHub Pages will serve the PWA over HTTPS, which is required for the service worker.

## Artwork

The first version uses emoji as temporary visual placeholders. The vocabulary is stored separately in `data/concepts.json`.

To replace a visual, add an image/SVG asset and update the `visual` field and the rendering code in `app.js`.

The internal `concept` field is for development only and is not shown to the child.

## Planned next improvements

- Replace emoji with a consistent custom illustration set.
- Add a parent-controlled language/audio layer without putting words on the child-facing pages.
- Add category browsing.
- Add optional narration/recording.
- Add a polished EPUB/PDF export.

## Current visual prototype

The first 10 concepts now use realistic generated picture-book images. Concepts 11–200 still use temporary emoji placeholders so the navigation/content system can be tested before the full illustration set is produced.

## Replacing the pictures

You can replace the pictures without changing any code.

Put your files in the `images` folder using the number of the picture:

```text
001.jpg
002.jpg
003.png
004.jpg
005.png
...
200.jpg
```

Both **JPG/JPEG** and **PNG** are supported automatically.

The number corresponds to the picture's position in the book. For example:

- `001.jpg` or `001.png` = baby
- `002.jpg` or `002.png` = mother
- `003.jpg` or `003.png` = dog
- `004.jpg` or `004.png` = banana
- `005.jpg` or `005.png` = cup

You can mix JPG and PNG files. If both `001.jpg` and `001.png` exist, the JPG is used first.

If a picture is missing, the app automatically displays the temporary placeholder. This lets you replace the pictures gradually.

Recommended: use clear, high-resolution images with the main subject large and easy for a young child to recognize.
