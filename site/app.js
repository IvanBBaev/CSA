/* ===== CSA Practice Exam — application logic ===== */
(() => {
  "use strict";

  const LS = {
    stats: "csa.stats",
    session: "csa.session",
    theme: "csa.theme",
  };

  /** @type {Array} full question bank */
  let BANK = [];

  /** runtime session state */
  let S = null;
  let timerInt = null;

  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    // Buttons default to type="submit"; force "button" so a click can never
    // trigger an implicit form submission / page reload.
    if (tag === "button") e.type = "button";
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const fmtTime = (sec) => {
    const m = Math.floor(sec / 60), s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };
  const sameSet = (a, b) =>
    a.length === b.length && a.every((x) => b.includes(x));

  // Trailing "(Choose two.)" style hint on multi-answer questions.
  const HINT_RE = /\s*\(\s*choose[^)]*\)\s*$/i;

  // Question text as shown to the user: the answer-count hint is hidden unless
  // the current session opted in via the "Show number of correct answers" box.
  const displayText = (q) =>
    S && S.showCounts ? q.text : q.text.replace(HINT_RE, "");

  // Normalized stem used for duplicate detection: drop the answer-count hint,
  // lowercase, and collapse whitespace so wording-identical items collapse.
  const normKey = (q) =>
    q.text.replace(HINT_RE, "").toLowerCase().replace(/\s+/g, " ").trim();

  // Keep the first occurrence of each distinct question stem.
  function dedupeQuestions(pool) {
    const seen = new Set();
    return pool.filter((q) => {
      const k = normKey(q);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove("show"), 1800);
  }

  // ---------- persistence ----------
  const loadStats = () => {
    try { return JSON.parse(localStorage.getItem(LS.stats)) || {}; }
    catch { return {}; }
  };
  const saveStats = (s) => localStorage.setItem(LS.stats, JSON.stringify(s));

  const saveSession = () => {
    if (!S || S.finished) return;
    const slim = {
      mode: S.mode, order: S.order, answers: S.answers,
      flagged: [...S.flagged], revealed: [...S.revealed], idx: S.idx,
      elapsed: S.elapsed, shuffleMap: S.shuffleMap, showCounts: S.showCounts,
    };
    localStorage.setItem(LS.session, JSON.stringify(slim));
  };
  const clearSession = () => localStorage.removeItem(LS.session);
  const peekSession = () => {
    try { return JSON.parse(localStorage.getItem(LS.session)); }
    catch { return null; }
  };

  // ---------- theme ----------
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    $("themeBtn").firstChild.textContent = t === "dark" ? "🌙 " : "☀️ ";
    localStorage.setItem(LS.theme, t);
  }
  $("themeBtn").addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme");
    applyTheme(cur === "dark" ? "light" : "dark");
  });

  // ---------- start screen wiring ----------
  const settings = { mode: "practice", count: "all" };

  function wireSeg(segId, key, cb) {
    $(segId).addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      [...$(segId).children].forEach((c) => c.setAttribute("aria-pressed", "false"));
      b.setAttribute("aria-pressed", "true");
      settings[key] = b.dataset[key];
      if (cb) cb();
    });
  }
  wireSeg("modeSeg", "mode");
  wireSeg("countSeg", "count");

  // Questions available to start with, given the current type + dedupe filters.
  function availableCount() {
    const types = [];
    if ($("incSingle").checked) types.push("single");
    if ($("incMulti").checked) types.push("multi");
    let pool = BANK.filter((q) => types.includes(q.type));
    if ($("dedupe").checked) pool = dedupeQuestions(pool);
    return pool.length;
  }

  function refreshStartStats() {
    const st = loadStats();
    const avail = availableCount();
    $("statTotal").textContent = avail;
    $("qCount").textContent = avail;
    $("statBest").textContent = st.best != null ? st.best + "%" : "–";
    $("statWorst").textContent = st.worst != null ? st.worst + "%" : "–";
    $("statAttempts").textContent = st.attempts || 0;
    renderHistory(st.history);
    const sess = peekSession();
    if (sess) {
      const answered = Object.keys(sess.answers || {}).length;
      $("statResume").textContent = `${answered}/${sess.order.length}`;
      $("resumeRow").classList.remove("hidden");
    } else {
      $("statResume").textContent = "–";
      $("resumeRow").classList.add("hidden");
    }
  }

  // Small bar chart of recent exam scores (oldest → newest, left → right).
  // Bars are colored by the same bands as the results verdict.
  function renderHistory(history) {
    const box = $("statHistory");
    if (!history || !history.length) { box.innerHTML = ""; box.classList.add("hidden"); return; }
    const recent = history.slice(-24);
    const band = (p) => (p >= 70 ? "ok" : p >= 55 ? "mid" : "low");
    const bars = recent
      .map((p, i) => {
        const n = history.length - recent.length + i + 1;
        const last = i === recent.length - 1 ? " hbar-last" : "";
        return `<div class="hbar hbar-${band(p)}${last}" style="height:${Math.max(6, p)}%" title="Attempt ${n}: ${p}%"></div>`;
      })
      .join("");
    box.innerHTML =
      `<div class="history-head"><span>Score history</span><span>last ${recent.length}</span></div>` +
      `<div class="hbars">${bars}</div>`;
    box.classList.remove("hidden");
  }

  // ---------- build session ----------
  function buildOrder() {
    const types = [];
    if ($("incSingle").checked) types.push("single");
    if ($("incMulti").checked) types.push("multi");
    let pool = BANK.filter((q) => types.includes(q.type));
    if (!pool.length) { toast("Select at least one question type"); return null; }

    if ($("dedupe").checked) pool = dedupeQuestions(pool);

    if ($("shuffleQ").checked) pool = shuffle(pool);
    if (settings.count !== "all") {
      const n = parseInt(settings.count, 10);
      pool = pool.slice(0, n);
    }
    const order = pool.map((q) => q.id);

    // per-question option shuffle map
    const shuffleMap = {};
    if ($("shuffleO").checked) {
      pool.forEach((q) => {
        if (q.options.length) shuffleMap[q.id] = shuffle(q.options.map((_, i) => i));
      });
    }
    return { order, shuffleMap };
  }

  function startSession(restore) {
    if (restore) {
      S = {
        mode: restore.mode, order: restore.order, answers: restore.answers || {},
        flagged: new Set(restore.flagged || []), idx: restore.idx || 0,
        elapsed: restore.elapsed || 0, shuffleMap: restore.shuffleMap || {},
        finished: false, showCounts: !!restore.showCounts,
        revealed: new Set(restore.revealed || Object.keys(restore.answers || {}).map(Number)),
      };
    } else {
      const built = buildOrder();
      if (!built) return;
      S = {
        mode: settings.mode, order: built.order, answers: {},
        flagged: new Set(), idx: 0, elapsed: 0, shuffleMap: built.shuffleMap,
        finished: false, revealed: new Set(), showCounts: $("showCounts").checked,
      };
    }
    show("quiz");
    startTimer();
    renderQuestion();
    saveSession();
  }

  // ---------- timer ----------
  function startTimer() {
    stopTimer();
    timerInt = setInterval(() => {
      S.elapsed++;
      $("timer").textContent = fmtTime(S.elapsed);
      if (S.elapsed % 5 === 0) saveSession();
    }, 1000);
    $("timer").textContent = fmtTime(S.elapsed);
  }
  const stopTimer = () => { if (timerInt) clearInterval(timerInt); timerInt = null; };

  // ---------- question access ----------
  const qById = (id) => BANK.find((q) => q.id === id);
  const curQ = () => qById(S.order[S.idx]);

  function orderedOptions(q) {
    const map = S.shuffleMap[q.id];
    if (!map) return q.options;
    return map.map((i) => q.options[i]);
  }

  // ---------- render question ----------
  function renderQuestion() {
    const q = curQ();
    const total = S.order.length;

    $("progLabel").textContent = `Question ${S.idx + 1} of ${total}`;
    const answered = Object.keys(S.answers).length;
    $("answeredLabel").textContent = `${answered} answered`;
    $("progBar").style.width = `${((S.idx + 1) / total) * 100}%`;

    // badges
    const badges = $("qBadges");
    badges.innerHTML = "";
    badges.appendChild(el("span", "badge", `#${q.id}`));
    const typeLabel = { single: "Single choice", multi: "Multiple answers" }[q.type];
    badges.appendChild(el("span", `badge ${q.type}`, typeLabel));
    if (S.flagged.has(q.id)) badges.appendChild(el("span", "badge flag", "⚑ Flagged"));

    $("qText").innerHTML = escapeHtml(displayText(q));
    renderImage(q);

    renderOptions(q);
    renderFeedback(q);

    // flag button
    $("flagBtn").setAttribute("aria-pressed", S.flagged.has(q.id) ? "true" : "false");

    // nav button labels
    $("prevBtn").disabled = S.idx === 0;
    $("nextBtn").textContent = S.idx === total - 1 ? "Finish ✓" : "Next →";

    if (!$("gridPanel").classList.contains("hidden")) renderGrid();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Optional illustration attached to a question (ServiceNow UI screenshot).
  function renderImage(q) {
    const fig = $("qImage");
    if (!q.image) { fig.innerHTML = ""; fig.classList.add("hidden"); return; }
    const src = q.image.split("/").map(encodeURIComponent).join("/");
    fig.innerHTML = `<img src="${src}" alt="Illustration for question #${q.id}" loading="lazy" />`;
    fig.classList.remove("hidden");
  }

  function renderOptions(q) {
    const box = $("qOptions");
    box.innerHTML = "";

    const sel = S.answers[q.id] || [];
    const reveal = S.mode === "practice" && S.revealed.has(q.id);

    orderedOptions(q).forEach((o) => {
      const btn = el("button", "opt");
      btn.dataset.letter = o.letter;
      const isSel = sel.includes(o.letter);
      const isCorrect = q.correct.includes(o.letter);

      if (reveal) {
        btn.disabled = true;
        if (isCorrect) btn.classList.add("correct");
        else if (isSel) btn.classList.add("wrong");
        if (isSel || isCorrect) btn.classList.add("revealed");
      } else if (isSel) {
        btn.classList.add("selected");
      }

      const mark = reveal
        ? (isCorrect ? '<span class="mark">✓</span>' : (isSel ? '<span class="mark">✗</span>' : ""))
        : "";

      btn.innerHTML =
        `<span class="letter">${o.letter}</span><span class="otext">${escapeHtml(o.text)}</span>${mark}`;
      btn.onclick = () => selectOption(q, o.letter);
      box.appendChild(btn);
    });
  }

  function selectOption(q, letter) {
    if (S.mode === "practice" && S.revealed.has(q.id)) return; // locked after reveal
    let sel = S.answers[q.id] ? S.answers[q.id].slice() : [];

    if (q.type === "multi") {
      if (sel.includes(letter)) sel = sel.filter((l) => l !== letter);
      else sel.push(letter);
      if (sel.length) S.answers[q.id] = sel;
      else delete S.answers[q.id]; // empty selection = unanswered
      renderOptions(q);
      renderFeedback(q); // refresh the "Check answer" affordance
    } else {
      sel = [letter];
      S.answers[q.id] = sel;
      if (S.mode === "practice") {
        S.revealed.add(q.id);
        renderOptions(q);
        renderFeedback(q);
      } else {
        renderOptions(q);
      }
    }
    updateAnsweredLabel();
    saveSession();
  }

  function updateAnsweredLabel() {
    $("answeredLabel").textContent = `${Object.keys(S.answers).length} answered`;
  }

  function renderFeedback(q) {
    const fb = $("feedback");
    if (S.mode !== "practice" || !S.revealed.has(q.id)) {
      fb.classList.add("hidden");
      // In practice + multi, offer a "check" button
      if (S.mode === "practice" && q.type === "multi" && !S.revealed.has(q.id) && (S.answers[q.id] || []).length) {
        fb.classList.remove("hidden");
        fb.className = "feedback";
        fb.innerHTML = "";
        const need = q.correct.length;
        const label = S.showCounts ? `Check answer (${need} expected)` : "Check answer";
        const btn = el("button", "btn-primary", label);
        btn.style.width = "auto";
        btn.onclick = () => { S.revealed.add(q.id); renderOptions(q); renderFeedback(q); saveSession(); };
        fb.appendChild(btn);
      }
      return;
    }
    const sel = S.answers[q.id] || [];
    const ok = sameSet(sel, q.correct);
    fb.classList.remove("hidden");
    fb.className = "feedback " + (ok ? "ok" : "no");
    const correctText = q.correct.join(", ");
    fb.innerHTML = ok
      ? `<b>✓ Correct!</b> Answer: <b>${correctText}</b>`
      : `<b>✗ Incorrect.</b> Correct answer: <b>${correctText}</b>` +
        (sel.length ? ` · You chose: ${sel.join(", ")}` : " · (no selection)");
  }

  // ---------- navigation ----------
  function go(delta) {
    const n = S.idx + delta;
    if (n < 0 || n >= S.order.length) return;
    S.idx = n;
    renderQuestion();
    saveSession();
  }
  $("prevBtn").onclick = () => go(-1);
  $("nextBtn").onclick = () => {
    if (S.idx === S.order.length - 1) finish();
    else go(1);
  };
  $("flagBtn").onclick = () => {
    const q = curQ();
    if (S.flagged.has(q.id)) S.flagged.delete(q.id);
    else S.flagged.add(q.id);
    renderQuestion();
    saveSession();
  };
  $("gridToggle").onclick = () => {
    const p = $("gridPanel");
    p.classList.toggle("hidden");
    if (!p.classList.contains("hidden")) { renderGrid(); p.scrollIntoView({ behavior: "smooth" }); }
  };
  $("finishBtn").onclick = () => finish();

  function renderGrid() {
    const g = $("grid");
    g.innerHTML = "";
    S.order.forEach((id, i) => {
      const c = el("button", "gcell", String(i + 1));
      if (S.answers[id]) c.classList.add("answered");
      if (S.flagged.has(id)) c.classList.add("flagged");
      if (i === S.idx) c.classList.add("current");
      c.onclick = () => { S.idx = i; renderQuestion(); window.scrollTo({ top: 0, behavior: "smooth" }); };
      g.appendChild(c);
    });
  }

  // ---------- finish & score ----------
  function gradeOne(q) {
    const sel = S.answers[q.id];
    if (!sel || !sel.length) return "skip";
    return sameSet(sel, q.correct) ? "correct" : "wrong";
  }

  function finish() {
    const unanswered = S.order.filter((id) => {
      const sel = S.answers[id];
      return !sel || !sel.length;
    });
    if (unanswered.length && S.mode === "exam") {
      if (!confirm(`${unanswered.length} question(s) unanswered. Finish anyway?`)) return;
    }
    S.finished = true;
    stopTimer();

    let correct = 0, wrong = 0, skip = 0;
    S.order.forEach((id) => {
      const r = gradeOne(qById(id));
      if (r === "correct") correct++;
      else if (r === "wrong") wrong++;
      else skip++;
    });
    const graded = correct + wrong;
    const pct = graded ? Math.round((correct / graded) * 100) : 0;

    // persist stats
    const st = loadStats();
    st.attempts = (st.attempts || 0) + 1;
    st.best = Math.max(st.best || 0, pct);
    st.worst = st.worst == null ? pct : Math.min(st.worst, pct);
    st.history = [...(st.history || []), pct].slice(-30);
    st.lastPct = pct;
    saveStats(st);
    clearSession();

    showResults({ correct, wrong, skip, pct });
  }

  function showResults({ correct, wrong, skip, pct }) {
    show("results");
    $("ring").style.setProperty("--p", pct);
    $("scorePct").textContent = pct + "%";
    $("rCorrect").textContent = correct;
    $("rWrong").textContent = wrong;
    $("rSkipped").textContent = skip;
    $("rTime").textContent = fmtTime(S.elapsed);

    // CSA passing score is 70%.
    let verdict, color;
    if (pct >= 70) { verdict = "🎉 Pass-ready! Excellent work."; color = "var(--green)"; }
    else if (pct >= 55) { verdict = "👍 Almost there — review the misses."; color = "var(--amber)"; }
    else { verdict = "📖 Keep studying — focus on weak areas."; color = "var(--red)"; }
    const v = $("verdict"); v.textContent = verdict; v.style.color = color;
    $("ring").style.background =
      `conic-gradient(${color} calc(var(--p)*1%), var(--bg-elev2) 0)`;

    buildReview();
  }

  function buildReview() {
    const list = $("reviewList");
    list.innerHTML = "";
    const wrongs = S.order.filter((id) => gradeOne(qById(id)) === "wrong");
    const skips = S.order.filter((id) => gradeOne(qById(id)) === "skip");

    if (wrongs.length) {
      const card = el("div", "card");
      card.appendChild(el("div", "section-title", `✗ Incorrect (${wrongs.length})`));
      wrongs.forEach((id) => card.appendChild(reviewItem(qById(id))));
      list.appendChild(card);
    }
    if (skips.length) {
      const card = el("div", "card");
      card.appendChild(el("div", "section-title", `– Skipped / unanswered (${skips.length})`));
      skips.forEach((id) => card.appendChild(reviewItem(qById(id))));
      list.appendChild(card);
    }
    if (!wrongs.length && !skips.length) {
      const card = el("div", "card");
      card.innerHTML = "<div class='section-title'>Perfect — every graded question correct! 🏆</div>";
      list.appendChild(card);
    }
  }

  function reviewItem(q) {
    const wrap = el("div", "review-item");
    wrap.appendChild(el("div", "review-q", `#${q.id} · ${escapeHtml(displayText(q))}`));
    const sel = S.answers[q.id] || [];
    const correctTxt = q.correct
      .map((l) => `${l}) ${escapeHtml((q.options.find((o) => o.letter === l) || {}).text || "")}`)
      .join("  ·  ");
    wrap.appendChild(el("div", "review-line", `<span class="tag-ok">Correct:</span> ${correctTxt}`));
    if (sel.length) {
      const yourTxt = sel
        .map((l) => `${l}) ${escapeHtml((q.options.find((o) => o.letter === l) || {}).text || "")}`)
        .join("  ·  ");
      wrap.appendChild(el("div", "review-line", `<span class="tag-no">Your answer:</span> ${yourTxt}`));
    } else {
      wrap.appendChild(el("div", "review-line muted", "Not answered"));
    }
    return wrap;
  }

  // ---------- results actions ----------
  $("retryWrongBtn").onclick = () => {
    const wrongs = S.order.filter((id) => gradeOne(qById(id)) === "wrong");
    if (!wrongs.length) { toast("No wrong answers to retry 🎉"); return; }
    S = {
      mode: S.mode, order: shuffle(wrongs), answers: {}, flagged: new Set(),
      idx: 0, elapsed: 0, shuffleMap: {}, finished: false, revealed: new Set(),
      showCounts: S.showCounts,
    };
    show("quiz"); startTimer(); renderQuestion(); saveSession();
  };
  $("reviewBtn").onclick = () => $("reviewList").scrollIntoView({ behavior: "smooth" });
  $("newBtn").onclick = () => { clearSession(); refreshStartStats(); show("start"); };

  // Keep the top question count in sync with the type + dedupe filters.
  ["dedupe", "incSingle", "incMulti"].forEach((id) =>
    $(id).addEventListener("change", refreshStartStats)
  );

  // ---------- start buttons ----------
  $("startBtn").onclick = () => { clearSession(); startSession(null); };
  $("resumeBtn").onclick = () => {
    const sess = peekSession();
    if (sess) startSession(sess);
  };
  $("homeBrand").onclick = () => {
    if (S && !S.finished && Object.keys(S.answers).length) saveSession();
    stopTimer(); refreshStartStats(); show("start");
  };

  // ---------- keyboard ----------
  document.addEventListener("keydown", (e) => {
    if ($("screen-quiz").classList.contains("hidden")) return;
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    const q = curQ();
    const k = e.key.toUpperCase();
    if (/^[A-J]$/.test(k)) {
      const opt = q.options.find((o) => o.letter === k);
      if (opt) { selectOption(q, k); e.preventDefault(); }
    } else if (e.key === "ArrowRight" || e.key === "Enter") {
      $("nextBtn").click(); e.preventDefault();
    } else if (e.key === "ArrowLeft") {
      go(-1); e.preventDefault();
    } else if (k === "F") {
      $("flagBtn").click(); e.preventDefault();
    }
  });

  // ---------- screen switch ----------
  function show(name) {
    ["start", "quiz", "results"].forEach((s) =>
      $("screen-" + s).classList.toggle("hidden", s !== name)
    );
  }

  // ---------- boot ----------
  applyTheme(localStorage.getItem(LS.theme) || "dark");
  fetch("questions.json")
    .then((r) => r.json())
    .then((data) => { BANK = data; refreshStartStats(); })
    .catch((err) => {
      $("screen-start").innerHTML =
        `<div class="card"><h2>Could not load questions</h2><p class="muted">Serve this folder over HTTP (e.g. <span class="kbd">python3 -m http.server</span>) rather than opening the file directly.<br><br>${escapeHtml(err.message)}</p></div>`;
    });

  // warn before accidental close mid-session
  window.addEventListener("beforeunload", () => { if (S && !S.finished) saveSession(); });
})();
