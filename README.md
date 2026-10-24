# Yiming · A Thousand Echoes

**English** | [简体中文](README.zh-CN.md)

Explore a Chinese bronze chime bell, hear how one bell can produce two tones, and play melodies in a browser.

[**Try the English version**](https://shawnsiao.github.io/yiming-qian-nian/?lang=en) · [中文版](https://shawnsiao.github.io/yiming-qian-nian/?lang=zh)

## Play and explore

- **Hear the difference.** Tap the center and either side of the large bell on the home screen. Drag to rotate, pinch to zoom and pan, or use the keyboard.
- **Play a phrase.** Choose a score, hear a demonstration, then follow the highlighted striking area. Wait mode advances only after the correct note; timed mode follows a beat.
- **Keep the bells playable on a phone.** The stage adapts between 7, 14 and 21 bells. Narrow portrait screens wrap each seven-bell register into two visual lines. Change the pitch range when a melody moves beyond the visible bells. Landscape provides more room.
- **Read while playing.** Wide screens place a resizable score beside the bells. Phones retain a compact phrase strip beneath the stage.
- **Save an idea.** Record your strikes, name the piece when saving, rename it later, and replay it from **Saved**. These are note-event recordings, not microphone recordings or audio files.
- **Look inside.** Explore the single 3D bell, select structural parts, or open a cutaway. Explanations link to museum and research sources.

The interface supports English and Simplified Chinese. A first visit follows the browser's supported language; the language button saves a preference. `?lang=en` and `?lang=zh` override it. Language changes preserve saved recordings and pause an active exercise at its current position.

## Notes and range

English pitch labels use scientific pitch notation: **C4** is middle C; **F♯4** is F-sharp above it. The Chinese interface retains the original small-letter octave labels.

Numbered scores use scale degrees **1–7**. `1=C` makes 1 equal C; `1=F` makes it F. Dots above or below move a note by an octave. The pitch name beneath each score note identifies the corresponding bell.

Each register retains seven natural center notes, from C through B, with this modern performance mapping:

| Bell center | Either side |
| --- | --- |
| C | E |
| D | F |
| E | E |
| F | F♯ |
| G | B |
| A | C in the next octave |
| B | B |

Selectable registers span **C3–B6**, with the highest A-bell side reaching **C7**. This mapping includes natural notes and F-sharp; it is **not a complete chromatic instrument**. Pitch pairs and seven-bell groups are an interaction design, not a reconstruction of the tuning of a particular excavated set.

## Scores

The library includes introductory exercises, familiar melodies and two versions of **Zhuzhi Ci**:

- **Short:** the supplied eight-bar theme, about 30 seconds, `1=C`.
- **Full:** a draft transcription covering the supplied 2:33 recording, `1=F`, with reference audio, MIDI, MusicXML and a printable score page.

The full version follows prominent strikes in an ensemble. It has not received expert note-by-note verification or reliable separation of bronze bells and stone chimes. **＊** marks notes requiring review. Its reference accompaniment is also a transcription estimate. Arrangements and third-party music have separate rights considerations; see [credits and asset notes](docs/credits.md).

## Sound, storage and model limits

Sound is enabled by default, but browsers may require the first tap before starting audio. Use the volume control or replay the entrance after interacting. Performance tones and the entrance sound are synthesized, not recordings of a museum instrument. Reduced-motion preferences are respected, and rendering stops when the scene is idle or hidden.

Saved pieces, volume and language preferences stay in browser storage. There is no application backend, microphone capture, account system or analytics integration. Existing R14/R15 recordings use the same storage identity. Clearing site data or using a different browser/device can remove or separate saved work. Initial page and asset loading requires a network connection; no offline cache installation is provided.

The photo-informed 3D model is an educational approximation. Proportions, wall thickness, decoration and reconstructed inscription lettering are not a measured archaeological replica. The cutaway is a structural illustration, not an acoustic simulation.

## Run locally

Use Node.js 24 or later. No dependency installation or bundling is needed:

```sh
node scripts/serve.mjs
```

Open [http://127.0.0.1:4312/app/](http://127.0.0.1:4312/app/). The server sets JavaScript MIME types explicitly, including `.mjs` on Windows.

```sh
node tests/i18n.mjs
node tests/current-model.mjs
node tests/home-arrival.mjs
node tests/mobile-viewport.mjs
node tests/practice.mjs
node tests/workspace.mjs
node scripts/build-pages.mjs
node tests/pages.mjs
```

The build writes only the generated `_site/` directory. Pull requests run validation; pushes merged into `main` publish that artifact through GitHub Actions to GitHub Pages. Repository-local design studies, Blender sources, original WAV files and validation output are excluded.

## Earlier previews

[**R15**](https://shawnsiao.github.io/yiming-qian-nian/versions/r15/) · [**R14**](https://shawnsiao.github.io/yiming-qian-nian/versions/r14/)

These archived URLs remain available. The current app lives in [`app/`](app/). Browser viewport checks do not replace real iPhone/Android testing.

## License

Project code is provided under [MIT](LICENSE). Vendored libraries retain their own MIT notices. Music, reference recordings, reference photography and museum material are not granted an MIT license by this repository; consult the [credits and asset notes](docs/credits.md) before reusing them.
