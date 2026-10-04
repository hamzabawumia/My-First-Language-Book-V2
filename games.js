"use strict";
/* Shared helpers for Quiz and Spelling modes. Relies on globals from app.js (state, $, audioPath, stopAudio). */
const G = { sound: {}, hasSound: false, timer: null, last: null, keyOpt: null, tokens: {}, specials: {} };
const ROUND = 10;
const SCREENS = ["cover", "topics", "reader", "menu", "play", "results", "review"];
const SPECIAL = { "ɛ": "e", "ɔ": "o", "ŋ": "n" };

const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const rand = (a) => a[Math.floor(Math.random() * a.length)];
const pretty = (c) => { const s = c.replace(/_/g, " & "); return s[0].toUpperCase() + s.slice(1); };

// "é" -> "e", "ɛ" -> "e", "ñ" -> "n", case-insensitive
const fold = (s) => s.toLowerCase().replace(/[ɛɔŋ]/g, (c) => SPECIAL[c]).normalize("NFD").replace(/\p{M}/gu, "");
const graphemes = (s) => {
  s = s.normalize("NFC");
  return (window.Intl && Intl.Segmenter)
    ? Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s), (x) => x.segment)
    : Array.from(s);
};
const isLetter = (g) => /\p{L}/u.test(g);

function showScreen(id) { SCREENS.forEach((s) => { $(s).hidden = s !== id; }); }
function goHome() { clearTimeout(G.timer); G.keyOpt = null; stopAudio(); showScreen("cover"); }

function setPicture(el, item) {
  const srcs = [`images/${item.id}.jpg`, `images/${item.id}.png`];
  let n = 0;
  el.innerHTML = `<img class="real-image" src="${srcs[0]}" alt="" draggable="false">`;
  el.querySelector("img").addEventListener("error", function onErr() {
    n += 1;
    if (n < srcs.length) { this.src = srcs[n]; this.addEventListener("error", onErr, { once: true }); }
    else el.textContent = item.visual || "🖼️";
  }, { once: true });
}

function playWord(item) {
  stopAudio();
  return new Promise((res) => {
    const word = state.translations[item.id].word;
    const tts = () => {
      if (!("speechSynthesis" in window)) return res();
      const u = new SpeechSynthesisUtterance(word);
      u.lang = state.language.voiceLocale || "en-US"; u.rate = 0.82;
      u.onend = u.onerror = () => res();
      speechSynthesis.speak(u);
    };
    const a = new Audio(audioPath(state.language.language, item.id));
    state.audio = a;
    a.onended = () => res();
    a.onerror = () => { state.audio = null; tts(); };
    a.play().catch(() => a.onerror());
  });
}

// Is there any way to speak words for this language (mp3 or matching browser voice)?
function soundOk() {
  const code = state.language.language;
  if (G.sound[code]) return G.sound[code];
  return (G.sound[code] = new Promise((res) => {
    const loc = (state.language.voiceLocale || "").toLowerCase();
    const voice = () => "speechSynthesis" in window &&
      speechSynthesis.getVoices().some((v) => v.lang.replace("_", "-").toLowerCase() === loc);
    const a = new Audio(audioPath(code, state.items[0].id));
    const t = setTimeout(() => res(voice()), 2000);
    a.addEventListener("loadedmetadata", () => { clearTimeout(t); res(true); }, { once: true });
    a.addEventListener("error", () => { clearTimeout(t); res(voice()); }, { once: true });
    a.load();
  }));
}

// Choose ROUND concepts. `must` ids (missed words) come first, then the chosen topic, then anything eligible.
function pickRound(cat, must = [], pred = () => true) {
  const all = state.items.filter(pred);
  const inCat = cat === "all" ? all : all.filter((x) => x.category === cat);
  const chosen = [];
  must.forEach((id) => { const it = all.find((x) => x.id === id); if (it && chosen.length < ROUND) chosen.push(it); });
  const fill = (a) => shuffle(a).forEach((it) => { if (chosen.length < ROUND && !chosen.includes(it)) chosen.push(it); });
  fill(inCat); fill(all);
  return shuffle(chosen);
}

// Letters used by the current language that are not plain a-z (for the special-letters strip)
function specialLetters() {
  const code = state.language.language;
  if (!G.specials[code]) {
    const set = new Set();
    Object.values(state.translations).forEach((t) => graphemes(t.word.toLowerCase()).forEach((g) => { if (isLetter(g) && !/^[a-z]$/.test(g)) set.add(g); }));
    G.specials[code] = [...set].sort();
  }
  return G.specials[code];
}
// All words (split on spaces) of the current pack, folded, for ambiguity checks
function packTokens() {
  const code = state.language.language;
  if (!G.tokens[code]) {
    G.tokens[code] = Object.values(state.translations).flatMap((t) => t.word.split(" ").map((w) => graphemes(w).map(fold)));
  }
  return G.tokens[code];
}

/* ---------- Round runner ---------- */
function runRound(items, renderQ, again, meta) {
  const R = { i: 0, results: [] };
  G.last = { again, results: R.results, meta };
  const note = $("playNote"), next = $("playNext");
  const adv = () => { R.i += 1; step(); };
  function step() {
    clearTimeout(G.timer); G.keyOpt = null; stopAudio();
    note.hidden = true; next.hidden = true;
    if (R.i >= items.length) return showResults();
    $("playText").textContent = `${R.i + 1} / ${items.length}`;
    $("playBar").style.width = `${((R.i + 1) / items.length) * 100}%`;
    $("playPrompt").innerHTML = ""; $("playBody").innerHTML = "";
    let fin = false;
    renderQ(items[R.i], R.i, {
      finish(res, auto) {
        if (fin) return; fin = true; R.results.push(res);
        if (res.note) { note.textContent = res.note; note.hidden = false; }
        next.textContent = R.i === items.length - 1 ? "See results ›" : "Next ›";
        if (auto) G.timer = setTimeout(adv, auto); else next.hidden = false;
      }
    });
  }
  next.onclick = adv;
  showScreen("play"); step();
}

function showResults() {
  const r = G.last.results, n = r.filter((x) => x.ok).length;
  $("resScore").textContent = n;
  $("resTotal").textContent = `out of ${r.length}`;
  const m = G.last.meta;
  if (m) { const p = loadProg(), lp = langProg(p); lp[m.mode][m.cat] = Math.max(lp[m.mode][m.cat] || 0, n); saveProg(p); }
  $("resMsg").textContent = n >= 9 ? "Amazing!" : n >= 6 ? "Great job!" : "Good try — practise makes perfect!";
  showScreen("results");
}
function showReview() {
  const list = $("reviewList"); list.innerHTML = "";
  [...G.last.results].sort((a, b) => a.ok - b.ok).forEach((r) => {
    const it = state.items.find((x) => x.id === r.id);
    const card = h("div", "rev-card" + (r.ok ? "" : " missed"));
    const pic = h("div", "rev-pic"); setPicture(pic, it);
    const t = h("div", "rev-text");
    t.append(h("div", "rev-word", state.translations[r.id].word), h("div", "rev-en", it.concept));
    if (!r.ok) t.append(h("div", "rev-tag", "Practise this one"));
    if (r.note) t.append(h("div", "rev-note", r.note));
    card.append(pic, t);
    if (G.hasSound) { const b = h("button", "speak-btn", "🔊"); b.onclick = () => playWord(it); card.append(b); }
    list.appendChild(card);
  });
  showScreen("review");
}

/* ---------- Menu ---------- */
function openMenu(mode, preset) {
  showScreen("menu");
  $("menuTitle").textContent = mode === "quiz" ? "🎯 Take a quiz" : "✏️ Spelling";
  const sel = $("topicSelect"); sel.innerHTML = "";
  [["all", "All topics"], ...[...new Set(state.items.map((i) => i.category))].map((c) => [c, pretty(c)])]
    .forEach(([v, t]) => {
      const s = topicStats(v), best = s[mode === "quiz" ? "quiz" : "spell"];
      const o = h("option", null, `${topicIcon(v)} ${t} · learned ${s.learned}/${s.total}` + (best != null ? ` · best ${best}/${ROUND}` : " · not tested"));
      o.value = v; sel.appendChild(o);
    });
  if (preset) sel.value = preset;
  const box = $("menuButtons"); box.innerHTML = "";
  const add = (label, fn) => { const b = h("button", "primary-btn", label); b.onclick = () => fn(sel.value, []); box.appendChild(b); };
  if (mode === "quiz") add("Start the quiz", startQuiz);
  else { add("🧩 Complete the word", (c, m) => startSpell("complete", c, m)); add("🔀 Fix the word", (c, m) => startSpell("fix", c, m)); }
}

$("quizBtn").addEventListener("click", () => openMenu("quiz"));
$("spellBtn").addEventListener("click", () => openMenu("spell"));
["menuHome", "playHome", "resHome", "reviewHome"].forEach((id) => $(id).addEventListener("click", goHome));
$("tryAgainBtn").addEventListener("click", () => G.last.again(G.last.results.filter((x) => !x.ok).map((x) => x.id)));
$("reviewBtn").addEventListener("click", showReview);
$("reviewBack").addEventListener("click", () => showScreen("results"));
document.addEventListener("keydown", (e) => {
  if ($("play").hidden) return;
  if (e.key === "Escape") goHome();
  else if (/^[1-4]$/.test(e.key) && e.target.tagName !== "INPUT" && G.keyOpt) G.keyOpt(Number(e.key) - 1);
});

/* ---------- Progress (saved per language in localStorage) ---------- */
const ICONS = { all: "🌍", people: "👨‍👩‍👧", animals: "🐶", food: "🍎", home: "🏠", actions: "🏃", clothing: "👕", toys: "🧸", transport: "🚗", nature: "🌳", body_feelings: "😊", concepts: "💡" };
const topicIcon = (c) => ICONS[c] || "⭐";
const topicName = (c) => (c === "all" ? "All topics" : pretty(c));
function loadProg() { try { return JSON.parse(localStorage.getItem("progress-v1")) || {}; } catch (_) { return {}; } }
function saveProg(p) { try { localStorage.setItem("progress-v1", JSON.stringify(p)); } catch (_) {} }
function langProg(p) { const c = state.language.language; return p[c] || (p[c] = { seen: {}, quiz: {}, spell: {} }); }
function topicItems(cat) { return cat === "all" ? state.items : state.items.filter((i) => i.category === cat); }
function topicStats(cat) {
  const lp = langProg(loadProg()), items = topicItems(cat);
  return { total: items.length, learned: items.filter((i) => lp.seen[i.id]).length, quiz: lp.quiz[cat], spell: lp.spell[cat] };
}

// Called by app.js after every reader render
function afterRender() {
  if ($("reader").hidden) return;
  const item = state.deck[state.index];
  if (item) { const p = loadProg(); langProg(p).seen[item.id] = 1; saveProg(p); }
  const last = state.index === state.deck.length - 1;
  $("topicDone").hidden = !last;
  if (last) $("topicDoneMsg").textContent = `🎉 You finished ${topicName(G.readCat || "all")}! Ready for a test?`;
}

function openTopics() {
  stopAudio();
  const grid = $("topicGrid"); grid.innerHTML = "";
  ["all", ...new Set(state.items.map((i) => i.category))].forEach((cat) => {
    const s = topicStats(cat), done = s.learned === s.total;
    const card = h("button", "topic-card" + (done ? " done" : ""));
    card.append(h("div", "topic-icon", topicIcon(cat)), h("div", "topic-name", topicName(cat)),
      h("div", "topic-count", done ? `✓ Learned all ${s.total}` : `Learned ${s.learned} / ${s.total}`));
    const bar = h("div", "progress"), fill = h("div"); fill.style.width = `${(s.learned / s.total) * 100}%`;
    bar.append(fill); card.append(bar);
    const badges = h("div", "topic-badges");
    badges.append(h("span", "badge" + (s.quiz != null ? " got" : ""), s.quiz != null ? `🎯 ${s.quiz}/${ROUND}` : "🎯 no quiz yet"),
      h("span", "badge" + (s.spell != null ? " got" : ""), s.spell != null ? `✏️ ${s.spell}/${ROUND}` : "✏️ no spelling yet"));
    card.append(badges);
    card.onclick = () => startReading(cat);
    grid.appendChild(card);
  });
  showScreen("topics");
}

function startReading(cat) {
  G.readCat = cat;
  const lp = langProg(loadProg());
  state.deck = topicItems(cat);
  const firstNew = state.deck.findIndex((i) => !lp.seen[i.id]);
  state.index = firstNew > 0 ? firstNew : 0; // pick up where they left off
  showScreen("reader");
  render();
}

$("topicsHome").addEventListener("click", goHome);
$("doneQuiz").addEventListener("click", () => startQuiz(G.readCat || "all", []));
$("doneSpell").addEventListener("click", () => openMenu("spell", G.readCat || "all"));
$("doneTopics").addEventListener("click", openTopics);
