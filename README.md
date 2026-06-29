# CSA Practice Exam — interactive web app

A dynamic, browser-based quiz built from the `csa.pdf` SecExams question dump
(ServiceNow **Certified System Administrator**).

408 questions: 338 single-answer and 70 multi-answer ("choose two/three/four/…").
Either type can be toggled off on the start screen.

## Features

- **Practice mode** — instant per-question feedback (correct answer highlighted).
- **Exam mode** — answer everything, then get scored.
- Single- and multi-answer grading (exact-match).
- Configurable session: number of questions, included types, shuffle questions /
  options.
- Question **overview grid**, **flag for review**, prev/next navigation, timer.
- **Score screen** with verdict (passing mark 70%), per-question review, and
  "retry wrong only".
- Progress, best score and attempt count persisted in `localStorage`
  (resume an interrupted session).
- Keyboard shortcuts: `A–J` select · `→`/`Enter` next · `←` back · `F` flag.
- Light/dark theme.

Everything is client-side (vanilla HTML/CSS/JS + a static `questions.json`);
there is no backend or build step.

## Run

The app fetches `questions.json`, so it must be served over HTTP (opening
`index.html` from the filesystem is blocked by the browser's `file://` policy):

```bash
cd site
python3 -m http.server 8765
# open http://localhost:8765/
```

## Files

```
site/
  index.html        app shell
  styles.css        styling (dark/light)
  app.js            quiz engine
  questions.json    408 parsed questions (generated)
build-questions.py  rebuilds questions.json from csa.pdf
csa.pdf             source question dump
```

## Regenerating the data

Requires `poppler` (`brew install poppler`) for `pdftotext`.

```bash
python3 build-questions.py      # -> site/questions.json
```

The parser splits on `Question #N` headers, separates the question text from the
lettered options (A–J), and reads the correct set from the `Correct Answer:`
block (unioned with any inline `(Correct Answer)` markers). It validates that
options are contiguous, that the correct set is a subset of the options, and that
"choose N" counts match.
