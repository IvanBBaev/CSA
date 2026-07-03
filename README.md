# CSA Practice Exam — interactive web app

<!-- badges:start -->
[![license](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/IvanBBaev/CSA/deploy-pages.yml?branch=main&style=flat-square&logo=githubactions&logoColor=white&label=CI)](https://github.com/IvanBBaev/CSA/actions/workflows/deploy-pages.yml)
[![last commit](https://img.shields.io/github/last-commit/IvanBBaev/CSA?style=flat-square&logo=git&logoColor=white&label=last-commit)](https://github.com/IvanBBaev/CSA/commits/main)
[![live demo](https://img.shields.io/badge/live%20demo-online-brightgreen?style=flat-square&logo=githubpages&logoColor=white)](https://ivanbbaev.github.io/CSA/)
[![questions](https://img.shields.io/badge/questions-408-blue?style=flat-square)](site/questions.json)
[![build](https://img.shields.io/badge/build-none-success?style=flat-square)](#run)
[![vanilla JS](https://img.shields.io/badge/vanilla-HTML%20%C2%B7%20CSS%20%C2%B7%20JS-f7df1e?style=flat-square&logo=javascript&logoColor=black)](site/app.js)
<!-- badges:end -->

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

## Support

This app is built and maintained in my own time. If it's useful to you, please
consider supporting its continued development — every tip is genuinely appreciated.

- **[GitHub Sponsors](https://github.com/sponsors/IvanBBaev)** — one-off or
  recurring, with no platform fee taken out (the preferred option).
- **[Ko-fi](https://ko-fi.com/ivanbbaev)** — quick one-off support; it also
  accepts **PayPal**, so it's the fallback for anyone without a GitHub account.
- **[Donate (Donatree)](https://donatr.ee/ivanbbaev/)** — a no-account donation
  page (card, PayPal and more) for a one-off tip.

[![Sponsor on GitHub](https://img.shields.io/badge/Sponsor-GitHub-ea4aaa?style=flat-square&logo=githubsponsors&logoColor=white)](https://github.com/sponsors/IvanBBaev)
[![Support on Ko-fi](https://img.shields.io/badge/Ko--fi-Support-ff5e5b?style=flat-square&logo=kofi&logoColor=white)](https://ko-fi.com/ivanbbaev)
[![Donate via Donatree](https://img.shields.io/badge/Donate-Donatree-22c55e?style=flat-square&logo=liberapay&logoColor=white)](https://donatr.ee/ivanbbaev/)
