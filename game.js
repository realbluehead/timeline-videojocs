(() => {
  const $ = (id) => document.getElementById(id);
  const els = {
    score: $("score"), hits: $("hits"), misses: $("misses"), left: $("left"),
    current: $("current"), timeline: $("timeline"), wrap: document.querySelector(".timeline-wrap"),
    hint: $("hint"), toast: $("toast"), length: $("length"), restart: $("restart"),
    end: $("end"), endScore: $("end-score"), endDetail: $("end-detail"), endBest: $("end-best"), again: $("again"),
  };

  const BEST_KEY = "timeline-videojocs-best";
  let state;

  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Únic punt on es dibuixa una carta: per canviar-ne el disseny només cal tocar això (i el CSS de .card).
  function renderCard(card, { hidden = false } = {}) {
    const el = document.createElement("div");
    el.className = "card" + (hidden ? " hidden" : "");
    const t = (card.year - 1970) / (2025 - 1970);
    el.style.setProperty("--hue", Math.round(10 + t * 300));

    const art = document.createElement("div");
    art.className = "art";
    if (card.image) {
      const img = document.createElement("img");
      img.src = card.image;
      img.alt = card.title;
      art.append(img);
    } else {
      art.textContent = card.emoji || "🎮";
    }

    const year = document.createElement("div");
    year.className = "year";
    year.textContent = hidden ? "????" : card.year;

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = card.title;

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${card.studio} · ${card.platform}`;

    el.append(art, year, title, meta);
    return el;
  }

  function newGame() {
    const n = Number(els.length.value);
    const deck = shuffle(window.DECK);
    const pool = n ? deck.slice(0, n + 1) : deck;
    state = {
      timeline: [pool[0]],
      deck: pool.slice(1),
      current: null,
      score: 0, hits: 0, misses: 0,
      locked: false,
      lastPlaced: 0,
      lastOk: null,
    };
    els.end.hidden = true;
    draw();
  }

  function draw() {
    state.current = state.deck.shift() || null;
    state.locked = false;
    render();
    if (!state.current) setTimeout(finish, 900);
  }

  function render() {
    els.score.textContent = state.score;
    els.hits.textContent = state.hits;
    els.misses.textContent = state.misses;
    els.left.textContent = state.deck.length + (state.current ? 1 : 0);

    els.current.replaceChildren();
    if (state.current) {
      const c = renderCard(state.current, { hidden: true });
      c.draggable = true;
      c.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", "card");
        e.dataTransfer.effectAllowed = "move";
      });
      els.current.append(c);
      els.hint.hidden = false;
    } else {
      els.hint.hidden = true;
    }

    els.timeline.replaceChildren();
    els.timeline.classList.toggle("locked", state.locked || !state.current);
    els.timeline.append(makeSlot(0));
    state.timeline.forEach((card, i) => {
      const item = document.createElement("div");
      item.className = "tl-item";
      if (i === state.lastPlaced && state.lastOk !== null) {
        item.classList.add(state.lastOk ? "placed-ok" : "placed-ko");
      }
      const tick = document.createElement("div");
      tick.className = "tick";
      tick.textContent = card.year;
      item.append(renderCard(card), tick);
      els.timeline.append(item, makeSlot(i + 1));
    });
  }

  function makeSlot(index) {
    const slot = document.createElement("button");
    slot.className = "slot";
    slot.type = "button";
    slot.setAttribute("aria-label", slotLabel(index));
    const plus = document.createElement("span");
    plus.textContent = "+";
    slot.append(plus);
    slot.addEventListener("click", () => place(index));
    slot.addEventListener("dragover", (e) => { e.preventDefault(); slot.classList.add("over"); });
    slot.addEventListener("dragleave", () => slot.classList.remove("over"));
    slot.addEventListener("drop", (e) => { e.preventDefault(); place(index); });
    return slot;
  }

  function slotLabel(i) {
    const tl = state.timeline;
    if (i === 0) return `Col·locar abans de ${tl[0].title}`;
    if (i === tl.length) return `Col·locar després de ${tl[tl.length - 1].title}`;
    return `Col·locar entre ${tl[i - 1].title} i ${tl[i].title}`;
  }

  // Encert si l'any cap entre els veïns (els empats d'any compten com a encert).
  function isCorrect(index, year) {
    const prev = state.timeline[index - 1];
    const next = state.timeline[index];
    return (!prev || prev.year <= year) && (!next || year <= next.year);
  }

  function place(index) {
    if (state.locked || !state.current) return;
    state.locked = true;
    const card = state.current;
    const ok = isCorrect(index, card.year);

    let at = index;
    if (!ok) {
      at = state.timeline.findIndex((c) => c.year > card.year);
      if (at === -1) at = state.timeline.length;
    }
    state.timeline.splice(at, 0, card);
    state.lastPlaced = at;
    state.lastOk = ok;

    if (ok) { state.score++; state.hits++; } else { state.score--; state.misses++; }
    bumpScore(ok);
    toast(ok ? `Correcte! ${card.title} és de ${card.year}  +1` : `Ui! ${card.title} és de ${card.year}  −1`, ok);

    state.current = null;
    render();
    scrollToPlaced();
    setTimeout(draw, ok ? 900 : 1600);
  }

  function bumpScore(ok) {
    const b = els.score;
    b.classList.remove("bump-up", "bump-down");
    void b.offsetWidth;
    b.classList.add(ok ? "bump-up" : "bump-down");
  }

  function scrollToPlaced() {
    const item = els.timeline.querySelectorAll(".tl-item")[state.lastPlaced];
    if (item) item.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  let toastTimer;
  function toast(text, ok) {
    els.toast.textContent = text;
    els.toast.className = "toast show " + (ok ? "ok" : "ko");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 1800);
  }

  function readBest() {
    try { return Number(localStorage.getItem(BEST_KEY)); } catch { return NaN; }
  }

  function finish() {
    const best = readBest();
    const isRecord = Number.isNaN(best) || state.score > best || localStorageEmpty();
    if (isRecord) { try { localStorage.setItem(BEST_KEY, state.score); } catch {} }
    els.endScore.textContent = state.score;
    els.endDetail.textContent = `${state.hits} encerts i ${state.misses} errors`;
    els.endBest.textContent = isRecord ? "Nou rècord!" : `Rècord: ${best} punts`;
    els.end.hidden = false;
  }

  function localStorageEmpty() {
    try { return localStorage.getItem(BEST_KEY) === null; } catch { return true; }
  }

  els.restart.addEventListener("click", newGame);
  els.again.addEventListener("click", newGame);
  els.length.addEventListener("change", newGame);

  newGame();
})();
