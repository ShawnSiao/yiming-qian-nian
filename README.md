# Yiming · A Thousand Echoes

**English** | [简体中文](README.zh-CN.md)

Explore a Chinese bronze chime bell, hear how one bell can produce two tones, and play melodies in a browser.

[**Try the English version**](https://shawnsiao.github.io/yiming-qian-nian/?lang=en) · [中文版](https://shawnsiao.github.io/yiming-qian-nian/?lang=zh)

## Play and explore

- **Hear the difference.** Tap the center and either side of the large 2D bell on the home screen, or use Enter/Space and the left/right arrows. The lightweight entrance never blocks playing or navigation.
- **Play a phrase.** Choose a score, hear a demonstration, then follow the highlighted striking area. Wait mode advances only after the correct note; timed mode follows a beat.
- **Keep the bells playable on a phone.** The stage adapts between 4, 8 and 12 bells, with exactly four in each row. Focus on one register for larger bells, or expand the available registers. Change range without changing the notes' pitches.
- **Read while playing.** Wide screens place a resizable score beside the bells. Phones retain a compact phrase strip beneath the stage.
- **Save an idea.** Record your strikes, name the piece when saving, rename it later, and replay it from **Saved**. These are note-event recordings, not microphone recordings or audio files.
- **Look inside.** Select structural parts in the observation page; the cavity has a pre-rendered section image. Turn on **3D** to rotate, zoom, pan or open a live cutaway. Explanations link to museum and research sources.

The interface supports English and Simplified Chinese. A first visit follows the browser's supported language; the language button saves a preference. `?lang=en` and `?lang=zh` override it. Language changes preserve saved recordings and pause an active exercise at its current position.

## Notes and range

English pitch labels use scientific pitch notation: **C4** is middle C. Chinese labels show **C4/E4 as c¹/e¹**, **C5/E5 as c²/e²**, and so on. These labels do not transpose the sound.

Numbered scores use scale degrees **1–7**. `1=C`, `1=F` and `1=G` make 1 equal C, F and G respectively. Dots above or below move a note by an octave. The pitch name beneath each score note identifies its actual pitch; notes without a matching bell are listen-only.

Use **Pitches ⇄ Numbers** in the performance toolbar to switch the bell plaques and playing prompts. Numbered labels follow the selected score's key, including `1=F` for the full Zhuzhi Ci draft and `1=G` for Qing Tian. Switching keeps the current striking areas, sound, practice position and recording intact. The original gold-edged plaques remain on the bell and its lower corners.

Each register has four bells with this modern performance mapping. Both lower corners sound the same side note:

| Bell center | Either side |
| --- | --- |
| C | E |
| D | F |
| G | B |
| A | C in the next octave |

The selectable registers cover the natural notes **C3–C7**; three rows starting at C4 provide **22 distinct pitches, C4–C7**. Neighboring registers share their boundary C. This layout has no F-sharp or other accidentals. Scores with missing pitches can be previewed at their original pitches, without false bell highlights. Bars containing missing pitches are listen-only; the remaining bars support practice. No score notes are removed or retuned. Four-bell groups are this project's interaction design, not a reconstruction of the tuning of a particular excavated set.

Existing recordings keep their saved MIDI pitches and storage identity. A note highlights a matching point on the current rack when available; otherwise it still sounds at its saved pitch, without a false highlight. Stored events are not rewritten.

## Scores

The library includes introductory exercises, familiar melodies and two versions of **Zhuzhi Ci**:

- **Short:** the supplied eight-bar theme, about 30 seconds, `1=C`.
- **Full:** a draft transcription covering the supplied 2:33 recording, `1=F`, with reference audio, MIDI, MusicXML and a printable score page.

The full version follows prominent strikes in an ensemble. It has not received expert note-by-note verification or reliable separation of bronze bells and stone chimes. **＊** marks notes requiring review. Its reference accompaniment is also a transcription estimate. Arrangements and third-party music have separate rights considerations; see [credits and asset notes](docs/credits.md).

**Yan Hua Yi Leng · Sheet excerpt** follows the user-supplied numbered score at `1=C`, 4/4, 77 BPM: a two-beat pickup and 28 full bars, about 89 seconds. It supports a full excerpt demonstration and phrase practice, retaining rests, ties and grace notes. The introduction contains pitches outside the four-bell instrument and is not included; the cropped image has no final cadence or repeat ending, so this excerpt plays the main staff once. It is not presented as the complete composition.

**Qing Tian / Sunny Day** follows the two user-supplied score pages at `1=G`, 4/4, 67 BPM: 69 bars, including the introduction, with about 4:06 of original-pitch playback. Rests, octave dots, grace notes, ties and within-bar accidentals are retained. Bars containing F♯, C♯ or D♯ are listen-only on the current rack. The closing X section has no fixed pitch; its groups remain as a rhythm reference and melodic playback ends before it.

## Sound, storage and model limits

Sound is enabled by default, but browsers may require the first tap before starting audio. Use the volume control or replay the entrance after interacting. Performance tones and the entrance sound are synthesized, not recordings of a museum instrument. Reduced-motion preferences are respected, and rendering stops when the scene is idle or hidden.

**3D is off on every new page or refresh.** The default home and observation pages use images rendered from the current model, without downloading GLB, Three.js or creating WebGL. The switch applies only to those two pages and keeps its selection within the current page. While 3D prepares, the 2D bell remains available. A 30-second preparation timeout, unsupported WebGL or context loss returns to 2D with a retry action. Model bytes can finish downloading in the background while playing; leaving a model page releases its GPU scene. Switching display mode preserves volume, audition progress and fading sound. Each image loads independently, trying PNG if WebP fails, with a playable local outline if both fail.

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
node tests/paired-pitches.mjs
node tests/numbered-notation.mjs
node tests/yanhua-yi-leng.mjs
node tests/resource-loading.mjs
node scripts/build-pages.mjs
node tests/pages.mjs
```

Browser regression checks use development-only Playwright; no npm package is shipped in the app:

```sh
npm ci
npx playwright install --with-deps chromium firefox webkit
npm run test:browser
```

On Windows, the suite also checks installed Chrome and Edge. Reports state unavailable browser/audio capabilities explicitly. Emulated phone sizes and the WebKit test build do not replace physical iPhone Safari, Android Chrome or the originally affected remote Edge computer.

The build writes only the generated `_site/` directory. Pull requests run validation; pushes merged into `main` publish that artifact through GitHub Actions to GitHub Pages. Repository-local design studies, Blender sources, original WAV files and validation output are excluded.

## Earlier previews

[**R15**](https://shawnsiao.github.io/yiming-qian-nian/versions/r15/) · [**R14**](https://shawnsiao.github.io/yiming-qian-nian/versions/r14/)

These archived URLs remain available. The current app lives in [`app/`](app/). Browser viewport checks do not replace real iPhone/Android testing.

## License

Project code is provided under [MIT](LICENSE). Vendored libraries retain their own MIT notices. Music, reference recordings, reference photography and museum material are not granted an MIT license by this repository; consult the [credits and asset notes](docs/credits.md) before reusing them.
