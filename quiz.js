"use strict";
/* Take a quiz: 10 questions, picture→word, word→picture, listen→picture (if sound is available). */

async function startQuiz(cat, must = []) {
  G.hasSound = await soundOk();
  const items = pickRound(cat, must);
  const types = ["pic2word", "word2pic"].concat(G.hasSound ? ["listen"] : []);
  const seq = shuffle(items.map((_, i) => types[i % types.length]));
  runRound(items, (item, i, ctx) => quizQuestion(item, seq[i], ctx), (missed) => startQuiz(cat, missed), { mode: "quiz", cat });
}

function distractors(item) {
  const word = (it) => state.translations[it.id].word.toLowerCase();
  const seen = new Set([word(item)]);
  const out = [];
  const take = (pool) => shuffle(pool).forEach((it) => {
    if (out.length < 3 && it.id !== item.id && !seen.has(word(it))) { seen.add(word(it)); out.push(it); }
  });
  take(state.items.filter((x) => x.category === item.category));
  take(state.items);
  return out;
}

function quizQuestion(item, type, ctx) {
  const pr = $("playPrompt"), body = $("playBody");
  const word = state.translations[item.id].word;
  const opts = shuffle([item, ...distractors(item)]);

  if (type === "pic2word") {
    const p = h("div", "q-pic"); setPicture(p, item);
    pr.append(h("div", "q-ask", `What is this in ${state.language.englishName}?`), p);
  } else {
    pr.append(h("div", "q-ask", type === "listen" ? "Listen and find the picture" : "Find the picture for"));
    if (type === "word2pic") pr.append(h("div", "q-word", word));
    const s = h("button", "speak-btn big", "🔊");
    s.onclick = () => playWord(item);
    pr.append(s);
    if (type === "listen") playWord(item);
  }

  const grid = h("div", "opt-grid " + (type === "pic2word" ? "words" : "pics"));
  const btns = [];
  let done = false;
  opts.forEach((o) => {
    const b = h("button", "opt");
    if (type === "pic2word") b.textContent = state.translations[o.id].word;
    else { const p = h("div", "opt-pic"); setPicture(p, o); b.append(p); }
    b.onclick = () => {
      if (done) return; done = true;
      const ok = o === item;
      btns.forEach((x, i) => { x.disabled = true; if (opts[i] === item) x.classList.add("right"); });
      if (!ok) b.classList.add("wrong");
      playWord(item);
      ctx.finish({ id: item.id, ok }, ok ? 1400 : 0);
    };
    btns.push(b); grid.appendChild(b);
  });
  body.appendChild(grid);
  G.keyOpt = (n) => btns[n] && btns[n].click();
}
