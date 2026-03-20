const tops = [
  {
    id: "top-tee-white",
    name: "White Tee",
    meta: "Cotton • everyday",
    tag: "shirt",
    img: "../assets/top/white_tee.webp",
  },
  {
    id: "top-oxford-blue",
    name: "Blue Oxford",
    meta: "Crisp • smart casual",
    tag: "shirt",
    img: "../assets/top/blue_oxford.png",   
  },
  {
    id: "top-knit-black",
    name: "Black Knit",
    meta: "Soft • layered",
    tag: "sweater",
    img: "../assets/top/black_knit.webp",
  },
  {
    id: "top-bomber-olive",
    name: "Olive Bomber",
    meta: "Light • streetwear",
    tag: "jacket",
    img: "../assets/top/olive_bomber.png",
  },
  {
    id: "top-denim-indigo",
    name: "Indigo Denim",
    meta: "Classic • durable",
    tag: "jacket",
    img: "../assets/top/indigo_denim.webp",
  },
  {
    id: "top-blazer-charcoal",
    name: "Charcoal Blazer",
    meta: "Sharp • tailored",
    tag: "jacket",
    img: "../assets/top/charcoal_blazer.png",
  },
];

const bottoms = [
  {
    id: "btm-jeans-straight",
    name: "Straight Jeans",
    meta: "Mid rise • blue",
    tag: "pants",
    img: "../assets/bottom/straight_jeans.png",
  },
  {
    id: "btm-trouser-black",
    name: "Black Trousers",
    meta: "Clean • modern",
    tag: "pants",
    img: "../assets/bottom/black_trousers.png",
  },
  {
    id: "btm-chino-sand",
    name: "Sand Chinos",
    meta: "Relaxed • warm tone",
    tag: "pants",
    img: "../assets/bottom/sand_chinos.png",
  },
  {
    id: "btm-skirt-pleated",
    name: "Pleated Skirt",
    meta: "Light • flow",
    tag: "skirt",
    img: "../assets/bottom/pleated_skirt.png",
  },
  {
    id: "btm-skirt-satin",
    name: "Satin Midi",
    meta: "Dressy • subtle sheen",
    tag: "skirt",
    img: "../assets/bottom/satin_midi.png",
  },
  {
    id: "btm-cargo-gray",
    name: "Gray Cargo",
    meta: "Utility • pockets",
    tag: "pants",
    img: "../assets/bottom/gray_cargo.png",
  },
];

const els = {
  topsCarousel: document.getElementById("topsCarousel"),
  bottomsCarousel: document.getElementById("bottomsCarousel"),
  statusText: document.getElementById("statusText"),
  previewTopValue: document.getElementById("previewTopValue"),
  previewBottomValue: document.getElementById("previewBottomValue"),
  previewTopMeta: document.getElementById("previewTopMeta"),
  previewBottomMeta: document.getElementById("previewBottomMeta"),
  previewTopImg: document.getElementById("previewTopImg"),
  previewBottomImg: document.getElementById("previewBottomImg"),
  previewMeta: document.getElementById("previewMeta"),
  playLabel: document.getElementById("playLabel"),
  btnBrowse: document.getElementById("btnBrowse"),
  btnLeft: document.getElementById("btnLeft"),
  btnRight: document.getElementById("btnRight"),
  btnPlayPause: document.getElementById("btnPlayPause"),
  btnDress: document.getElementById("btnDress"),
};

/** @type {{topId: string|null, bottomId: string|null, activeRail: "tops"|"bottoms"}} */
const state = {
  topId: null,
  bottomId: null,
  activeRail: "tops",
};

let isDressed = false;

let autoplayTimer = null;
const AUTOPLAY_MS = 1800;

function setStatus(text) {
  els.statusText.textContent = text;
}

function clampIndex(index, length) {
  if (length <= 0) return 0;
  return (index + length) % length;
}

function buildItemCard(item, rail) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "item";
  btn.setAttribute("role", "listitem");
  btn.dataset.id = item.id;
  btn.dataset.rail = rail;
  btn.setAttribute("aria-label", `${item.name} (${rail})`);

  const media = document.createElement("div");
  media.className = "itemMedia";

  const img = document.createElement("img");
  img.className = "itemImg";
  img.alt = item.name;
  img.loading = "lazy";
  img.decoding = "async";
  img.src = item.img;
  media.appendChild(img);

  const tag = document.createElement("div");
  tag.className = "tag";
  tag.textContent = item.tag;

  const body = document.createElement("div");
  body.className = "itemBody";

  const name = document.createElement("div");
  name.className = "itemName";
  name.textContent = item.name;

  const meta = document.createElement("div");
  meta.className = "itemMeta";
  meta.textContent = item.meta;

  body.append(name, meta);
  btn.append(media, tag, body);

  btn.addEventListener("click", () => {
    state.activeRail = rail;
    if (rail === "tops") state.topId = item.id;
    if (rail === "bottoms") state.bottomId = item.id;
    isDressed = false;
    syncSelectionUI();
    syncPreviewUI({ soft: true });
  });

  btn.addEventListener("focus", () => {
    state.activeRail = rail;
  });

  return btn;
}

function renderRails() {
  els.topsCarousel.innerHTML = "";
  els.bottomsCarousel.innerHTML = "";

  for (const item of tops) els.topsCarousel.appendChild(buildItemCard(item, "tops"));
  for (const item of bottoms) els.bottomsCarousel.appendChild(buildItemCard(item, "bottoms"));

  // Default selection
  state.topId = tops[0]?.id ?? null;
  state.bottomId = bottoms[0]?.id ?? null;
  syncSelectionUI();
  centerSelectedInView("tops");
  centerSelectedInView("bottoms");
  syncPreviewUI({ soft: true });
  setStatus("Ready. Select items to build an outfit.");
}

function getRailInfo(rail) {
  if (rail === "tops") {
    return { items: tops, carousel: els.topsCarousel, selectedId: state.topId };
  }
  return { items: bottoms, carousel: els.bottomsCarousel, selectedId: state.bottomId };
}

function setSelectedId(rail, id) {
  if (rail === "tops") state.topId = id;
  if (rail === "bottoms") state.bottomId = id;
}

function syncSelectionUI() {
  const all = document.querySelectorAll(".item");
  for (const el of all) {
    const rail = el.dataset.rail;
    const id = el.dataset.id;
    const selected = (rail === "tops" && id === state.topId) || (rail === "bottoms" && id === state.bottomId);
    el.classList.toggle("selected", selected);
    el.setAttribute("aria-selected", selected ? "true" : "false");
    el.tabIndex = selected ? 0 : -1;
  }
}

function centerSelectedInView(rail) {
  const { carousel, selectedId } = getRailInfo(rail);
  if (!selectedId) return;
  const el = carousel.querySelector(`.item[data-id="${CSS.escape(selectedId)}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
}

function scrollRailBy(rail, delta) {
  const { items, selectedId } = getRailInfo(rail);
  const idx = Math.max(0, items.findIndex((x) => x.id === selectedId));
  const nextIdx = clampIndex(idx + delta, items.length);
  const nextId = items[nextIdx]?.id ?? null;
  if (!nextId) return;
  setSelectedId(rail, nextId);
  isDressed = false;
  syncSelectionUI();
  centerSelectedInView(rail);
  syncPreviewUI({ soft: true });
}

function pickRandomOutfit({ center = true } = {}) {
  const top = tops[Math.floor(Math.random() * tops.length)];
  const bottom = bottoms[Math.floor(Math.random() * bottoms.length)];
  if (top) state.topId = top.id;
  if (bottom) state.bottomId = bottom.id;
  isDressed = false;
  syncSelectionUI();
  if (center) {
    centerSelectedInView("tops");
    centerSelectedInView("bottoms");
  }
  syncPreviewUI({ soft: true });
  setStatus(isDressed ? "Outfit changed." : "Browsing: randomized an outfit.");
}

function getSelectedItems() {
  const top = tops.find((t) => t.id === state.topId) ?? null;
  const bottom = bottoms.find((b) => b.id === state.bottomId) ?? null;
  return { top, bottom };
}

function setPreviewImage(imgEl, src, { animate = false, force = false } = {}) {
  if (!imgEl) return;
  const fallbackSrc = "../assets/fallback.jpg";

  if (!imgEl.dataset.fallbackBound) {
    imgEl.dataset.fallbackBound = "1";
    imgEl.addEventListener("error", () => {
      const current = imgEl.getAttribute("src") || "";
      if (!current) return;
      if (current.endsWith(fallbackSrc)) return;
      imgEl.classList.remove("isFading");
      imgEl.src = fallbackSrc;
    });
  }

  if (!src) {
    imgEl.removeAttribute("src");
    imgEl.classList.remove("isFading");
    imgEl.hidden = true;
    return;
  }
  imgEl.hidden = false;

  const current = imgEl.getAttribute("src");
  const same = current === src;

  if (!animate) {
    imgEl.src = src;
    imgEl.classList.remove("isFading");
    return;
  }

  // If the image is unchanged, still give a subtle "apply" feel when forced.
  if (same && !force) return;

  imgEl.classList.add("isFading");

  const applySrc = () => {
    if (!same) imgEl.src = src;
    const onLoad = () => {
      imgEl.classList.remove("isFading");
      imgEl.removeEventListener("load", onLoad);
    };
    imgEl.addEventListener("load", onLoad);
    // If already cached, load may not fire reliably in some cases; ensure we recover.
    window.setTimeout(() => imgEl.classList.remove("isFading"), 320);
  };

  window.setTimeout(applySrc, 170);
}

function pulsePreviewCard() {
  const card = document.querySelector(".previewCard");
  if (!card) return;
  card.classList.remove("applyPulse");
  // Force reflow to restart animation
  void card.offsetWidth;
  card.classList.add("applyPulse");
  window.setTimeout(() => card.classList.remove("applyPulse"), 520);
}

function syncPreviewUI({ soft, animate = false, forceImages = false } = { soft: false, animate: false, forceImages: false }) {
  const { top, bottom } = getSelectedItems();

  els.previewTopValue.textContent = top?.name ?? "None selected";
  els.previewBottomValue.textContent = bottom?.name ?? "None selected";
  els.previewTopMeta.textContent = top?.meta ?? "";
  els.previewBottomMeta.textContent = bottom?.meta ?? "";

  if (!isDressed) {
    setPreviewImage(els.previewTopImg, "", { animate: false });
    setPreviewImage(els.previewBottomImg, "", { animate: false });
  } else {
    setPreviewImage(els.previewTopImg, top?.img ?? "", { animate, force: forceImages });
    setPreviewImage(els.previewBottomImg, bottom?.img ?? "", { animate, force: forceImages });
  }

  if (soft && !isDressed) {
    els.previewMeta.textContent = "Previewing selection.";
  }
}

function setDressedUI(on) {
  const card = document.querySelector(".previewCard");
  card?.classList.toggle("dressed", on);
}

function dress() {
    if (isAutoplaying()) {
        stopAutoplay();
      }
  const { top, bottom } = getSelectedItems();
  if (!state.topId || !state.bottomId) {
    setStatus("Select a top and a bottom first.");
    return;
  }
  isDressed = true;
  setDressedUI(true);
  pulsePreviewCard();
  syncPreviewUI({ soft: false, animate: true, forceImages: true });
  els.previewMeta.textContent = `Dressed: ${top?.name ?? "Top"} + ${bottom?.name ?? "Bottom"}`;
  setStatus("Outfit applied.");
  window.setTimeout(() => setDressedUI(false), 1200);
}

function isAutoplaying() {
  return autoplayTimer != null;
}

function setPlayPauseUI() {
  const playing = isAutoplaying();
  els.playLabel.textContent = playing ? "❚❚" : "▶";
  els.btnPlayPause.setAttribute("aria-label", playing ? "Pause" : "Play");
}

function startAutoplay() {
  if (autoplayTimer) return;
  autoplayTimer = window.setInterval(() => {
    pickRandomOutfit({ center: false });
    centerSelectedInView("tops");
    centerSelectedInView("bottoms");
  }, AUTOPLAY_MS);
  setPlayPauseUI();
  setStatus("Playing: auto-browsing outfits.");
}

function stopAutoplay() {
  if (!autoplayTimer) return;
  window.clearInterval(autoplayTimer);
  autoplayTimer = null;
  setPlayPauseUI();
  setStatus("Paused.");
}

function toggleAutoplay() {
  if (isAutoplaying()) stopAutoplay();
  else startAutoplay();
}

function scrollActive(delta) {
  const rail = state.activeRail;
  scrollRailBy(rail, delta);
  setStatus(`${rail === "tops" ? "Tops" : "Bottoms"}: moved ${delta < 0 ? "left" : "right"}.`);
}

function hookControls() {
  els.btnBrowse.addEventListener("click", () => pickRandomOutfit({ center: true }));
  els.btnLeft.addEventListener("click", () => scrollActive(-1));
  els.btnRight.addEventListener("click", () => scrollActive(1));
  els.btnPlayPause.addEventListener("click", () => toggleAutoplay());
  els.btnDress.addEventListener("click", () => dress());

  els.topsCarousel.addEventListener("pointerdown", () => (state.activeRail = "tops"));
  els.bottomsCarousel.addEventListener("pointerdown", () => (state.activeRail = "bottoms"));

  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      scrollActive(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      scrollActive(1);
    } else if (e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      toggleAutoplay();
    } else if (e.key === "b" || e.key === "B") {
      pickRandomOutfit({ center: true });
    } else if (e.key === "d" || e.key === "D") {
      dress();
    }
  });
}

renderRails();
hookControls();
setPlayPauseUI();

