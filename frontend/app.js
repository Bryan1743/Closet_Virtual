let tops = [];
let bottoms = [];
window._userProfile = null;

// Load profile from sessionStorage and skip onboarding if exists
(function loadStoredProfile() {
  try {
    const stored = sessionStorage.getItem('userProfile');
    if (stored) {
      window._userProfile = JSON.parse(stored);
    }
  } catch (e) {}
})();

async function loadWardrobe() {
  try {
    const res = await fetch("http://localhost:4000/api/wardrobe");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    tops = Array.isArray(data.tops) ? data.tops : [];
    bottoms = Array.isArray(data.bottoms) ? data.bottoms : [];
  } catch (err) {
    console.error("Failed to load wardrobe data:", err);
    setStatus("Could not connect to wardrobe server.");
  }
}

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

(async function init() {
  await loadWardrobe();
  renderRails();
  hookControls();
  setPlayPauseUI();
  window.dispatchEvent(new Event('resize'));
  setTimeout(() => {
    centerSelectedInView("tops");
    centerSelectedInView("bottoms");
  }, 100);
})();

// Analyze Modal
let analyzeFile = null;
let analyzeFileDataUrl = null;

function openAnalyzeModal() {
  const modal = document.getElementById("analyzeModal");
  if (!modal) return;
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeAnalyzeModal() {
  const modal = document.getElementById("analyzeModal");
  if (!modal) return;
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function resetAnalyzeUI() {
  const preview = document.getElementById("analyzePreview");
  const previewImg = document.getElementById("analyzePreviewImg");
  const fileInput = document.getElementById("analyzeFileInput");
  const runBtn = document.getElementById("analyzeRunBtn");
  const loading = document.getElementById("analyzeLoading");
  const results = document.getElementById("analyzeResults");
  analyzeFile = null;
  analyzeFileDataUrl = null;
  if (fileInput) fileInput.value = "";
  if (preview) preview.hidden = true;
  if (previewImg) previewImg.removeAttribute("src");
  if (runBtn) runBtn.disabled = true;
  if (loading) loading.hidden = true;
  if (results) results.hidden = true;
}

function handleAnalyzeFileSelect(e) {
  const file = e.target.files?.[0];
  if (!file || !file.type.startsWith("image/")) return;
  analyzeFile = file;
  const reader = new FileReader();
  reader.onload = (ev) => {
    analyzeFileDataUrl = ev.target.result;
    const preview = document.getElementById("analyzePreview");
    const previewImg = document.getElementById("analyzePreviewImg");
    const runBtn = document.getElementById("analyzeRunBtn");
    if (previewImg) previewImg.src = analyzeFileDataUrl;
    if (preview) preview.hidden = false;
    if (runBtn) runBtn.disabled = false;
  };
  reader.readAsDataURL(file);
}

async function runAnalyze() {
  if (!analyzeFileDataUrl) return;
  const loading = document.getElementById("analyzeLoading");
  const results = document.getElementById("analyzeResults");
  const runBtn = document.getElementById("analyzeRunBtn");
  const upload = document.getElementById("analyzeUpload");
  const preview = document.getElementById("analyzePreview");

  if (loading) loading.hidden = false;
  if (results) results.hidden = true;
  if (runBtn) runBtn.disabled = true;
  if (upload) upload.hidden = true;
  if (preview) preview.hidden = true;

  try {
    const res = await fetch("http://localhost:4000/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: analyzeFileDataUrl }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderAnalyzeResults(data.profile);
    window._styleAnalysis = data.profile;
  } catch (err) {
    console.error("Analysis failed:", err);
    setStatus("Analysis failed: " + err.message);
    if (loading) loading.hidden = true;
    if (upload) upload.hidden = false;
    if (preview) preview.hidden = false;
    if (runBtn) runBtn.disabled = false;
  }
}

function renderAnalyzeResults(profile) {
  const loading = document.getElementById("analyzeLoading");
  const results = document.getElementById("analyzeResults");
  if (loading) loading.hidden = true;
  if (!results) return;
  const colors = (profile.recommendedColors || []).map((hex, i) => {
    const name = (profile.colorsDescription || [])[i] || hex;
    return `<div class="resultColorItem"><div class="resultColorSwatch" style="background:${hex}"></div><span class="resultColorName">${name}</span></div>`;
  }).join("");
  results.innerHTML = `
    <div class="resultSection">
      <h3 class="resultSectionTitle">Your Profile</h3>
      <div class="resultProfile">
        <div class="resultProfileItem"><span class="resultProfileLabel">Skin Tone</span><span class="resultProfileValue">${profile.skinTone || "—"}</span></div>
        <div class="resultProfileItem"><span class="resultProfileLabel">Body Type</span><span class="resultProfileValue">${profile.bodyType || "—"}</span></div>
      </div>
    </div>
    <div class="resultSection"><h3 class="resultSectionTitle">Recommended Colors</h3><div class="resultColors">${colors}</div></div>
    <div class="resultSection"><h3 class="resultSectionTitle">Style Advice</h3><p class="resultAdvice">${profile.styleAdvice || "No advice."}</p></div>
  `;
  results.hidden = false;
}

function hookAnalyzeModal() {
  const btn = document.getElementById("btnAnalyze");
  const closeBtn = document.getElementById("analyzeModalClose");
  const overlay = document.getElementById("analyzeModalOverlay");
  const fileInput = document.getElementById("analyzeFileInput");
  const runBtn = document.getElementById("analyzeRunBtn");
  if (btn) btn.addEventListener("click", openAnalyzeModal);
  if (closeBtn) closeBtn.addEventListener("click", closeAnalyzeModal);
  if (overlay) overlay.addEventListener("click", closeAnalyzeModal);
  if (fileInput) fileInput.addEventListener("change", handleAnalyzeFileSelect);
  if (runBtn) runBtn.addEventListener("click", runAnalyze);
}

// StyleAI Chat
const chatState = { history: [], isTyping: false };
let savedChatHTML = null;
let chatOpenedFirstTime = false;

function showTypingIndicator() {
  const messages = document.getElementById("chatMessages");
  if (!messages) return;
  const existing = document.getElementById("typingIndicator");
  if (existing) return;
  const msg = document.createElement("div");
  msg.className = "chatMsg chatMsgAI chatTyping";
  msg.id = "typingIndicator";
  msg.innerHTML = '<div class="chatBubble"><div class="typingDot"></div><div class="typingDot"></div><div class="typingDot"></div></div>';
  messages.appendChild(msg);
messages.scrollTop = messages.scrollHeight;
}

function closeChat() {
  document.getElementById("chatOverlay")?.setAttribute("hidden", "");
}

function openChat() {
  document.getElementById("chatOverlay")?.removeAttribute("hidden");
  document.getElementById("chatInput")?.focus();
  
  if (window._userProfile) {
    const messages = document.getElementById("chatMessages");
    if (messages) {
      messages.hidden = false;
      if (savedChatHTML !== null) {
        messages.innerHTML = savedChatHTML;
        savedChatHTML = null;
      } else if (!chatOpenedFirstTime) {
        chatOpenedFirstTime = true;
        messages.innerHTML = '';
        messages.hidden = false;
        const suggestions = document.getElementById("chatSuggestions");
        if (suggestions) suggestions.style.display = "flex";
        
        showTypingIndicator();
        setTimeout(() => {
          try {
            const typingEl = document.getElementById("typingIndicator");
            if (typingEl) typingEl.remove();
            
            const greeting = buildChatGreeting();
            console.log('[Chat Greeting]:', greeting);
            
            const msgDiv = document.createElement("div");
            msgDiv.className = "chatMsg chatMsgAI";
            msgDiv.innerHTML = '<div class="chatBubble">' + greeting + '</div>';
            messages.appendChild(msgDiv);
            messages.scrollTop = messages.scrollHeight;
          } catch (err) {
            console.error('[Chat Greeting Error]:', err);
            const msgDiv = document.createElement("div");
            msgDiv.className = "chatMsg chatMsgAI";
            msgDiv.innerHTML = '<div class="chatBubble">¡Hola! Soy StyleAI. ¿En qué puedo ayudarte hoy?</div>';
            messages.appendChild(msgDiv);
          }
        }, 800);
      }
    }
  }
}

function sanitizeMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/(?<!\*)\*(?!\*)/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/`[^`]+`/g, (m) => m.replace(/[`*]/g, ''));
}

function addChatMessage(role, text) {
  const messages = document.getElementById("chatMessages");
  const msg = document.createElement("div");
  msg.className = "chatMsg " + (role === "user" ? "chatMsgUser" : "chatMsgAI");
  const cleanText = role === "ai" ? sanitizeMarkdown(text) : text;
  msg.innerHTML = '<div class="chatBubble">' + cleanText + '</div>';
  messages.appendChild(msg);
  messages.scrollTop = messages.scrollHeight;
}

async function sendChatMessage(text) {
  if (!text.trim() || chatState.isTyping) return;
  const input = document.getElementById("chatInput");
  const sendBtn = document.getElementById("chatSend");
  input.value = "";
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 120) + "px";
  sendBtn.disabled = true;
  chatState.isTyping = true;
  addChatMessage("user", text);
  chatState.history.push({ role: "user", parts: text });
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        message: text, 
        history: chatState.history.slice(0, -1), 
        analysis: window._styleAnalysis || null,
        wardrobe: { tops: tops, bottoms: bottoms },
        userName: window._userProfile?.name || null,
        userGender: window._userProfile?.gender || null
      }),
    });
    const data = await res.json();
    if (data.success) {
      addChatMessage("ai", data.reply);
      chatState.history.push({ role: "model", parts: data.reply });
    } else {
      addChatMessage("ai", "Sorry, I had trouble responding.");
    }
  } catch (err) {
    addChatMessage("ai", "Connection error.");
  }
  chatState.isTyping = false;
  sendBtn.disabled = input.value.trim() === "";
}

document.getElementById("btnAnalyze")?.addEventListener("click", openAnalyzeModal);
document.getElementById("btnOpenChat")?.addEventListener("click", openChat);
document.getElementById("chatClose")?.addEventListener("click", closeChat);
document.getElementById("chatOverlay")?.addEventListener("click", (e) => { if (e.target === e.currentTarget) closeChat(); });
document.getElementById("chatInput")?.addEventListener("input", function() {
  this.style.height = "auto";
  this.style.height = Math.min(this.scrollHeight, 120) + "px";
  document.getElementById("chatSend").disabled = this.value.trim() === "";
});
document.getElementById("chatInput")?.addEventListener("keydown", (e) => { 
  e.stopPropagation();
  if (e.key === "Enter" && !e.shiftKey) { 
    e.preventDefault(); 
    const input = document.getElementById("chatInput");
    const text = input?.value?.trim();
    if (text) {
      sendChatMessage(text);
    }
  } 
});
document.getElementById("chatSend")?.addEventListener("click", () => sendChatMessage(document.getElementById("chatInput").value.trim()));
document.querySelectorAll(".chatChip").forEach(chip => chip.addEventListener("click", () => sendChatMessage(chip.dataset.msg)));

// Onboarding logic
function showOnboarding() {
  const el = document.getElementById("onboarding");
  if (el) el.setAttribute("aria-hidden", "false");
}

function hideOnboarding() {
  const el = document.getElementById("onboarding");
  if (el) el.setAttribute("aria-hidden", "true");
  setTimeout(() => { if (el) el.hidden = true; }, 500);
}

function updateOnboardingButton() {
  const name = document.getElementById("onboardingName")?.value.trim() || "";
  const genderSelected = document.querySelector(".genderChip.selected");
  const btn = document.getElementById("onboardingConfirm");
  if (btn) btn.disabled = !(name.length >= 2 && genderSelected);
}

function completeOnboarding(name, gender) {
  window._userProfile = { name, gender };
  sessionStorage.setItem('userProfile', JSON.stringify(window._userProfile));
  
  // Show user chip in header
  const chip = document.getElementById("userChip");
  if (chip) {
    chip.textContent = name;
    chip.style.display = "inline";
  }
  
  hideOnboarding();
}

function buildChatGreeting() {
  try {
    const hour = new Date().getHours();
    let timeSalutation;
    if (hour >= 5 && hour <= 11) timeSalutation = "Buenos días";
    else if (hour >= 12 && hour <= 17) timeSalutation = "Buenas tardes";
    else if (hour >= 18 && hour <= 20) timeSalutation = "Buenas tardes";
    else timeSalutation = "Buenas noches";

    const isFemale = window._userProfile?.gender === "female";
    const adjBien = isFemale ? "bienvenida" : "bienvenido";
    const adjPreparado = isFemale ? "preparada" : "preparado";
    const adjListo = isFemale ? "lista" : "listo";
    const name = window._userProfile?.name || "amigo";

    const greetings = [
      `${timeSalutation}, ${name}! ${adjBien} de nuevo. Tengo outfits increíbles para ti. ¿Qué te gustaría probar hoy?`,
      `¡${name}! Qué gusto volver a verte. Tu closet está esperando. ¿Empezamos con algo fresco?`,
      `${timeSalutation}, ${name}. Estoy ${adjPreparado} para ayudarte. Dime, ¿qué outfit buscas hoy?`,
      `Hey ${name}! ${timeSalutation} para descubrir algo increíble. ¿Por dónde empezamos?`,
      `${name}, ${timeSalutation}! Tu Virtual Closet tiene looks esperándote. ¿Lista para explorar?`.replace("¿Lista", isFemale ? "¿Lista" : "¿Listo"),
      `¡${timeSalutation}, ${name}! Aquí estamos de nuevo. Tengo combos perfectos para ti. ¿Qué estilo te llama hoy?`,
      `Bienvenido de nuevo, ${name}. Estoy listo con outfits increíbles. ¿Te animas a probar algo nuevo?`,
      `${timeSalutation === "Buenos días" ? "Día nuevo" : "Qué alegría"} verte, ${name}! Tu guardarropa está ${adjListo}. ¿Qué look vamos a crear?`
    ];

    let idx;
    do {
      idx = Math.floor(Math.random() * greetings.length);
    } while (idx === lastGreetingIndex && greetings.length > 1);
    lastGreetingIndex = idx;
    return greetings[idx];
  } catch (err) {
    console.error('[buildChatGreeting Error]:', err);
    return "¡Hola! Soy StyleAI. ¿En qué puedo ayudarte hoy?";
  }
}

// Onboarding event listeners
document.addEventListener("DOMContentLoaded", () => {
  if (window._userProfile) {
    const chip = document.getElementById("userChip");
    if (chip) { chip.textContent = window._userProfile.name; chip.style.display = "inline"; }
    const ob = document.getElementById("onboarding");
    if (ob) { ob.hidden = true; }
  } else {
    showOnboarding();
  }
  
  const nameInput = document.getElementById("onboardingName");
  const confirmBtn = document.getElementById("onboardingConfirm");
  const genderChips = document.querySelectorAll(".genderChip");
  const errorSpan = document.getElementById("onboardingError");
  let selectedGender = null;
  
  nameInput?.addEventListener("input", () => {
    const val = nameInput.value.trim();
    if (val && val.length < 2) {
      errorSpan.textContent = "Name must be at least 2 characters";
    } else {
      errorSpan.textContent = "";
    }
    updateOnboardingButton();
  });
  
  genderChips.forEach(chip => {
    chip.addEventListener("click", () => {
      genderChips.forEach(c => c.classList.remove("selected"));
      chip.classList.add("selected");
      selectedGender = chip.dataset.gender;
      updateOnboardingButton();
    });
  });
  
  confirmBtn?.addEventListener("click", () => {
    const name = nameInput?.value.trim();
    if (name && name.length >= 2 && selectedGender) {
      completeOnboarding(name, selectedGender);
    }
  });
});

let lastGreetingIndex = -1;

// Add hookAnalyzeModal to init
(async function init() {
  await loadWardrobe();
  renderRails();
  hookControls();
  hookAnalyzeModal();
  setPlayPauseUI();
  window.dispatchEvent(new Event("resize"));
  setTimeout(() => { centerSelectedInView("tops"); centerSelectedInView("bottoms"); }, 100);
})();

