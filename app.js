const state = {
  items: [],
  languages: [],
  language: null,
  translations: {},
  index: 0,
  startX: null,
  startY: null,
  audio: null
};

const $ = (id) => document.getElementById(id);

async function loadJSON(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path}.`);
  return response.json();
}

async function loadData() {
  try {
    const [items, codes] = await Promise.all([
      loadJSON("data/concepts.json"),
      loadJSON("languages/index.json")
    ]);
    const packs = await Promise.all(codes.map((code) => loadJSON(`languages/${code}/pack.json`)));
    return { items, packs };
  } catch (err) {
    // fetch() is blocked when index.html is opened via file:// — use the embedded copy
    if (!window.EMBEDDED_DATA) throw err;
    console.warn("fetch failed, using embedded data:", err);
    const d = window.EMBEDDED_DATA;
    return { items: d.concepts, packs: d.order.map((code) => d.packs[code]) };
  }
}

function audioPath(code, id) {
  return `languages/${code}/audio/${id}.mp3`;
}

function loadLanguage(code) {
  const language = state.languages.find((l) => l.language === code) || state.languages[0];
  validateData(state.items, language);
  state.language = language;
  state.translations = language.translations;
  state.index = 0;
  try { localStorage.setItem("language", language.language); } catch (_) {}
  applyLanguageText();
  render();
}

function applyLanguageText() {
  const { name, englishName } = state.language;
  document.documentElement.dataset.lang = state.language.language;
  document.title = `My First Language Book — ${name}`;
  document.querySelector(".eyebrow").textContent = `English → ${name}`;
  $("coverCount").textContent = state.items.length;
  $("subtitleLang").textContent = englishName;
  $("startBtn").textContent = `Start the ${englishName} book`;
  $("speakBtn").setAttribute("aria-label", `Hear ${englishName} pronunciation`);
  $("hintLang").textContent = englishName;
  $("aboutLang").textContent = englishName;
  $("aboutLang2").textContent = englishName;
  $("languageSelect").value = state.language.language;
}

async function loadBook() {
  const data = await loadData();
  state.items = data.items;
  state.languages = data.packs;

  const select = $("languageSelect");
  select.innerHTML = "";
  state.languages.forEach((l) => {
    const option = document.createElement("option");
    option.value = l.language;
    option.textContent = l.name;
    select.appendChild(option);
  });
  select.addEventListener("change", () => { try { loadLanguage(select.value); } catch (err) { showError(err); } });

  let saved = null;
  try { saved = localStorage.getItem("language"); } catch (_) {}
  loadLanguage(saved || state.languages[0].language);
}

function showError(error) {
  $("visual").textContent = "⚠️";
  $("englishHint").textContent = "Could not load the book";
  $("targetWord").textContent = String(error.message || error);
  console.error(error);
}

function validateData(items, language) {
  const code = language.language;
  const label = language.englishName || code;
  if (!Array.isArray(items) || items.length === 0) throw new Error("No concepts found.");
  const expectedIds = items.map((item) => item.id);
  const uniqueIds = new Set(expectedIds);
  if (uniqueIds.size !== items.length) throw new Error("Duplicate concept IDs found.");
  items.forEach((item, index) => {
    const expected = String(index + 1).padStart(3, "0");
    if (item.id !== expected) throw new Error(`Concept IDs must run 001..${items.length}. Found ${item.id} at position ${index + 1}.`);
    const translation = language.translations?.[item.id];
    if (!translation?.word) throw new Error(`Missing ${label} word for ${item.id}.`);
  });

  // The uploaded project contains these ten real photos. These mappings are intentional.
  const photoMap = {
    "001": "baby", "002": "mother", "003": "dog", "004": "banana", "005": "cup",
    "006": "ball", "007": "car", "008": "tree", "009": "eat", "010": "sleep"
  };
  for (const [id, concept] of Object.entries(photoMap)) {
    if (items.find((x) => x.id === id)?.concept !== concept) {
      throw new Error(`Picture ${id} is not mapped to ${concept}.`);
    }
  }
}

function render() {
  const item = state.items[state.index];
  if (!item) return;
  const translation = state.translations[item.id];
  const imageNumber = item.id;
  const imageSources = [`images/${imageNumber}.jpg`, `images/${imageNumber}.png`];
  let imageSourceIndex = 0;

  $("visual").innerHTML = `<img class="real-image" src="${imageSources[0]}" alt="${item.concept}" draggable="false">`;
  const image = $("visual").querySelector("img");
  image.addEventListener("error", () => {
    imageSourceIndex += 1;
    if (imageSourceIndex < imageSources.length) {
      image.src = imageSources[imageSourceIndex];
    } else {
      $("visual").textContent = item.visual || "🖼️";
    }
  }, { once: true });

  const current = state.index + 1;
  const total = state.items.length;
  $("englishHint").textContent = `English hint: ${item.concept}`;
  $("targetWord").textContent = translation.word;
  $("progressText").textContent = `${current} / ${total}`;
  $("progressBar").style.width = `${(current / total) * 100}%`;
  $("prevBtn").disabled = state.index === 0;
  $("nextBtn").disabled = state.index === total - 1;
  $("prevBtn").style.opacity = state.index === 0 ? ".35" : "1";
  $("nextBtn").style.opacity = state.index === total - 1 ? ".35" : "1";
  stopAudio();
}

function showReader() {
  $("cover").hidden = true;
  $("about").hidden = true;
  $("reader").hidden = false;
  render();
}

function go(delta) {
  const next = state.index + delta;
  if (next < 0 || next >= state.items.length) return;
  state.index = next;
  render();
}

function stopAudio() {
  if (state.audio) {
    state.audio.pause();
    state.audio.currentTime = 0;
    state.audio = null;
  }
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  $("speakBtn").classList.remove("speaking");
  $("speakBtn").textContent = "🔊";
}

async function playAudio() {
  const item = state.items[state.index];
  if (!item) return;
  const translation = state.translations[item.id];
  if (!translation) return;
  stopAudio();
  const audio = new Audio(audioPath(state.language.language, item.id));
  state.audio = audio;
  audio.addEventListener("playing", () => {
    $("speakBtn").classList.add("speaking");
    $("speakBtn").textContent = "⏹";
  });
  audio.addEventListener("ended", stopAudio);
  audio.addEventListener("error", () => {
    state.audio = null;
    if (!("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(translation.word);
    utterance.lang = state.language?.voiceLocale || "en-US";
    utterance.rate = 0.82;
    utterance.onstart = () => {
      $("speakBtn").classList.add("speaking");
      $("speakBtn").textContent = "⏹";
    };
    utterance.onend = stopAudio;
    utterance.onerror = stopAudio;
    window.speechSynthesis.speak(utterance);
  }, { once: true });
  try {
    await audio.play();
  } catch (_) {
    audio.dispatchEvent(new Event("error"));
  }
}

$("startBtn").addEventListener("click", () => {
  state.index = 0;
  showReader();
});

$("homeBtn").addEventListener("click", () => {
  stopAudio();
  $("reader").hidden = true;
  $("cover").hidden = false;
});

$("aboutBtn").addEventListener("click", () => $("about").hidden = false);
$("closeAbout").addEventListener("click", () => $("about").hidden = true);
$("prevBtn").addEventListener("click", () => go(-1));
$("nextBtn").addEventListener("click", () => go(1));
$("speakBtn").addEventListener("click", () => {
  if ($( "speakBtn" ).classList.contains("speaking")) stopAudio();
  else playAudio();
});

$("fullscreenBtn").addEventListener("click", async () => {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch (_) {}
});

document.addEventListener("keydown", (event) => {
  if ($("reader").hidden) return;
  if (event.key === "ArrowLeft") go(-1);
  if (event.key === "ArrowRight" || event.key === " ") {
    event.preventDefault();
    go(1);
  }
  if (event.key === "Enter") playAudio();
  if (event.key === "Escape" && !document.fullscreenElement) $("homeBtn").click();
});

const card = $("card");
card.addEventListener("pointerdown", (event) => {
  state.startX = event.clientX;
  state.startY = event.clientY;
});
card.addEventListener("pointerup", (event) => {
  if (state.startX === null) return;
  const dx = event.clientX - state.startX;
  const dy = event.clientY - state.startY;
  state.startX = state.startY = null;
  if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.2) go(dx < 0 ? 1 : -1);
});

window.addEventListener("error", (event) => console.error(event.error || event.message));

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").then((r) => r.update()).catch(console.error));
}

loadBook().catch(showError);
