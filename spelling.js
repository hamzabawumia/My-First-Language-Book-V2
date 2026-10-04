"use strict";
/* Spelling: "Complete the word" (fill blanks) and "Fix the word" (unscramble).
   Phrases focus on ONE word. Accent slips are accepted with a gentle note. */

const letterCount = (t) => graphemes(t).filter(isLetter).length;
const hasFocus = (it) => state.translations[it.id].word.split(" ").some((t) => letterCount(t) >= 3);

function focusInfo(item) {
  const word = state.translations[item.id].word;
  const tokens = word.split(" ");
  let c = tokens.map((t, i) => i).filter((i) => letterCount(tokens[i]) >= 4);
  if (!c.length) c = tokens.map((t, i) => i).filter((i) => letterCount(tokens[i]) >= 3);
  const idx = rand(c);
  const cells = graphemes(tokens[idx]);
  return { word, tokens, idx, cells, lp: cells.map((g, i) => (isLetter(g) ? i : -1)).filter((i) => i >= 0) };
}

async function startSpell(kind, cat, must = []) {
  G.hasSound = await soundOk();
  const items = pickRound(cat, must, hasFocus);
  runRound(items, (item, i, ctx) => (kind === "complete" ? spellComplete : spellFix)(item, ctx),
    (missed) => startSpell(kind, cat, missed), { mode: "spell", cat });
}

// Picture + English hint + tool buttons (sound / hint)
function spellPrompt(item, ask, onHint) {
  const pr = $("playPrompt");
  const p = h("div", "q-pic small"); setPicture(p, item);
  const tools = h("div", "q-tools");
  if (G.hasSound) { const s = h("button", "speak-btn", "🔊"); s.onclick = () => playWord(item); tools.append(s); }
  const hint = h("button", "speak-btn", "💡"); hint.onclick = onHint; tools.append(hint);
  pr.append(h("div", "q-ask", ask), p, h("div", "english-hint", `English: ${item.concept}`), tools);
  return hint;
}

// Build the word line: plain words, with the focus word made of custom cells
function wordLine(f, makeCell) {
  const line = h("div", "wordline");
  f.tokens.forEach((t, i) => {
    if (i !== f.idx) return line.append(h("span", "w-plain", t));
    const g = h("div", "w-group");
    f.cells.forEach((ch, k) => g.append(makeCell(ch, k)));
    line.append(g);
  });
  return line;
}

/* ----- Complete the word ----- */
function pickNonAdjacent(lp, k, force) {
  const chosen = force != null ? [force] : [];
  for (const i of shuffle(lp)) {
    if (chosen.length >= k) break;
    if (!chosen.some((c) => Math.abs(c - i) < 2)) chosen.push(i);
  }
  return chosen.length === k ? chosen : null;
}

function makeMask(f) {
  const L = f.lp.length;
  const want = L <= 4 ? 1 : L <= 6 ? 2 : 3;
  const maxK = Math.max(1, Math.min(want, Math.floor(L / 2)));
  const fl = f.cells.map(fold), target = fl.join("");
  const accented = f.lp.filter((i) => f.cells[i].toLowerCase() !== fl[i]);
  const others = packTokens().filter((t) => t.length === fl.length && t.join("") !== target);
  for (let k = maxK; k >= 1; k--) {
    for (let tr = 0; tr < 30; tr++) {
      const force = accented.length && Math.random() < 0.34 ? rand(accented) : null;
      const pick = pickNonAdjacent(f.lp, k, force);
      if (pick && !others.some((t) => fl.every((c, i) => pick.includes(i) || t[i] === c))) return pick;
    }
  }
  return [rand(f.lp)];
}

function spellComplete(item, ctx) {
  const f = focusInfo(item);
  const blanks = makeMask(f);
  let wrongs = 0, hints = 0, over = false, busy = false, slip = null, cur = null;
  const boxes = [];

  const hintBtn = spellPrompt(item, "Fill in the missing letters", () => { if (!over && !busy) reveal(); });
  const line = wordLine(f, (ch, k) => {
    if (!blanks.includes(k)) return h("div", "cell fixed", ch);
    const inp = h("input", "cell blank");
    inp.type = "text"; inp.autocomplete = "off"; inp.autocapitalize = "none"; inp.spellcheck = false;
    inp.setAttribute("aria-label", "missing letter");
    const b = { inp, ch, locked: false };
    inp.addEventListener("focus", () => { cur = b; });
    inp.addEventListener("input", () => {
      const g = graphemes(inp.value);
      inp.value = g.length ? g[g.length - 1] : "";
      if (!inp.value || busy) return;
      const nxt = boxes.find((x) => !x.locked && !x.inp.value && x !== b);
      if (nxt) nxt.inp.focus();
      if (boxes.every((x) => x.inp.value)) evaluate();
    });
    inp.addEventListener("keydown", (e) => {
      if (e.key !== "Backspace" || inp.value) return;
      const i = boxes.indexOf(b), prev = boxes.slice(0, i).reverse().find((x) => !x.locked);
      if (prev) { prev.inp.focus(); prev.inp.value = ""; }
    });
    boxes.push(b);
    return inp;
  });
  $("playBody").append(line);

  const specials = specialLetters();
  if (specials.length) {
    const strip = h("div", "special-strip");
    specials.forEach((s) => {
      const b = h("button", "special-key", s);
      b.addEventListener("pointerdown", (e) => e.preventDefault()); // keep keyboard focus on the box
      b.onclick = () => {
        const t = cur && !cur.locked ? cur : boxes.find((x) => !x.locked && !x.inp.value);
        if (!t || busy) return;
        t.inp.value = s; t.inp.dispatchEvent(new Event("input"));
      };
      strip.append(b);
    });
    $("playBody").append(strip);
  }
  if (boxes[0]) setTimeout(() => boxes[0].inp.focus(), 50);

  function lock(b) { b.locked = true; b.inp.readOnly = true; b.inp.classList.add("ok"); }
  function evaluate() {
    const bad = [];
    boxes.filter((b) => !b.locked).forEach((b) => {
      const v = b.inp.value;
      if (v === b.ch || v.toLowerCase() === b.ch.toLowerCase()) { b.inp.value = b.ch; lock(b); }
      else if (fold(v) === fold(b.ch)) { // right letter, missing accent: accept it
        b.inp.value = b.ch; lock(b);
        const kind = /\p{M}/u.test(b.ch.normalize("NFD")) ? "accent" : "special letter";
        slip = slip === "accent" ? "accent" : kind;
      } else bad.push(b);
    });
    if (!bad.length) return success();
    wrongs += 1; busy = true;
    bad.forEach((b) => b.inp.classList.add("shake"));
    setTimeout(() => {
      bad.forEach((b) => { b.inp.classList.remove("shake"); b.inp.value = ""; });
      busy = false;
      if (wrongs >= 2) reveal(); else bad[0].inp.focus();
    }, 500);
  }
  function reveal() {
    const b = boxes.find((x) => !x.locked);
    if (!b) return;
    hints += 1; b.inp.value = b.ch; lock(b);
    if (boxes.every((x) => x.locked)) success(); else { const n = boxes.find((x) => !x.locked); if (n) n.inp.focus(); }
  }
  function success() {
    if (over) return; over = true; hintBtn.disabled = true;
    line.classList.add("done");
    playWord(item);
    const note = slip ? `Remember the ${slip}: ${f.word}` : null;
    ctx.finish({ id: item.id, ok: wrongs === 0 && hints === 0, note }, note ? 0 : 1500);
  }
}

/* ----- Fix the word ----- */
function scramble(t) {
  const n = t.length;
  for (let k = 0; k < 80; k++) {
    const s = shuffle(t), wrong = s.filter((c, i) => c !== t[i]).length;
    if (wrong >= Math.ceil(n / 2)) return s;
  }
  return t.slice(1).concat(t[0]);
}

function spellFix(item, ctx) {
  const f = focusInfo(item);
  const target = f.lp.map((i) => f.cells[i]);
  const order = scramble(target);
  const locked = new Set();
  let sel = null, hints = 0, over = false;
  const tiles = [];

  const hintBtn = spellPrompt(item, "Put the letters in order", () => {
    if (over) return;
    const i = order.findIndex((c, k) => c !== target[k]);
    if (i < 0) return;
    const j = order.findIndex((c, k) => k > i && c === target[i]);
    [order[i], order[j]] = [order[j], order[i]];
    locked.add(i); sel = null; hints += 1; paint(); check();
  });
  const line = wordLine(f, (ch, k) => {
    if (!isLetter(ch)) return h("div", "cell fixed", ch);
    const li = f.lp.indexOf(k);
    const b = h("button", "cell tile");
    b.onclick = () => {
      if (over || locked.has(li)) return;
      if (sel === null) sel = li;
      else if (sel === li) sel = null;
      else { [order[sel], order[li]] = [order[li], order[sel]]; sel = null; }
      paint(); check();
    };
    tiles[li] = b;
    return b;
  });
  const swapHint = h("div", "swap-hint", "👆 Tap or click two letters to swap their positions");
  $("playBody").append(line, swapHint);
  paint();

  function paint() {
    tiles.forEach((b, i) => {
      b.textContent = order[i];
      b.classList.toggle("sel", sel === i);
      b.classList.toggle("ok", locked.has(i) || over);
    });
  }
  function check() {
    if (over || !order.every((c, i) => c === target[i])) return;
    over = true; hintBtn.disabled = true; swapHint.hidden = true; paint(); line.classList.add("done");
    playWord(item);
    ctx.finish({ id: item.id, ok: hints === 0 }, 1500);
  }
}
