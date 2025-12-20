const DATA_URL = "data/festivals.json";

function qs(name){
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

function parseDateISO(s){
  const [y,m,d] = s.split("-").map(Number);
  return new Date(y, (m-1), d);
}

function formatRange(f){
  const start = parseDateISO(f.startDate);
  const end = parseDateISO(f.endDate);
  const opts = { month:"short", day:"numeric" };
  const a = start.toLocaleDateString(undefined, opts);
  const b = end.toLocaleDateString(undefined, opts);
  const year = start.getFullYear();
  return `${a}–${b}, ${year}`;
}

/* =========================
   1) Arrival (defaults + overrides)
   ========================= */

const DEFAULT_ARRIVAL = {
  windows: [
    { label: "Early", detail: "Gates open – 1 PM (shortest lines, easiest entry)" },
    { label: "Midday", detail: "1 PM – 4 PM (balanced entry + time to explore)" },
    { label: "Late", detail: "After 4 PM (peak lines + congested walkways)" }
  ],
  firstSteps: [
    "Set a meetup point immediately (landmark + time).",
    "Fill water / hydrate before you start moving stage-to-stage.",
    "Screenshot: ticket/QR, entry gate, and pickup zone.",
    "Bathrooms early — lines surge later.",
    "Confirm your exit plan before headliner crowds build."
  ],
  warnings: [
    "Cell service can get unreliable near gates and after sunset.",
    "Security lines spike 60–90 minutes before headliners.",
    "Rideshare zones get congested — leaving 10 minutes early helps.",
    "Don’t rely on finding friends after dark without a meetup plan."
  ],
  campingNotes: [
    "Arrive earlier than you think — check-in lines can snowball.",
    "Set up essentials first (shade, water, chargers).",
    "Night temps can drop — pack a layer even if it’s hot."
  ]
};

function renderArrival(f){
  const a = f.arrival || {};
  const windows = a.windows || DEFAULT_ARRIVAL.windows;
  const firstSteps = a.firstSteps || DEFAULT_ARRIVAL.firstSteps;
  const warnings = a.warnings || DEFAULT_ARRIVAL.warnings;

  const windowsEl = document.getElementById("arrivalWindows");
  const stepsEl = document.getElementById("arrivalFirstSteps");
  const warnEl = document.getElementById("arrivalWarnings");

  if(windowsEl){
    windowsEl.innerHTML = windows.map(w =>
      `<div class="arrival-row"><b>${w.label}</b><span>${w.detail}</span></div>`
    ).join("");
  }
  if(stepsEl){
    stepsEl.innerHTML = firstSteps.map(t => `<li>${t}</li>`).join("");
  }
  if(warnEl){
    warnEl.innerHTML = warnings.map(t => `<li>${t}</li>`).join("");
  }

  // Camping card: show only if festival supports camping
  const campingCard = document.getElementById("arrivalCampingCard");
  const campingEl = document.getElementById("arrivalCamping");
  if(campingCard && campingEl){
    if(f.hasCamping){
      const camp = a.campingNotes || DEFAULT_ARRIVAL.campingNotes;
      campingEl.innerHTML = (camp || []).map(t => `<li>${t}</li>`).join("");
      campingCard.hidden = (camp || []).length === 0;
    } else {
      campingCard.hidden = true;
      campingEl.innerHTML = "";
    }
  }
}

/* =========================
   2) Essentials (defaults + optional overrides)
   ========================= */

const DEFAULT_ESSENTIALS = {
  base: [
    "Ticket / wristband",
    "ID",
    "Portable phone charger",
    "Comfortable walking shoes",
    "Water plan (bottle or hydration pack if allowed)",
    "Earplugs"
  ],
  weather: [
    "Sunscreen",
    "Hat / sunglasses",
    "Light layers (temps drop at night)",
    "Small towel or bandana"
  ],
  camping: [
    "Headlamp / flashlight",
    "Extra battery packs",
    "Warm layer for night",
    "Shade plan (tarp/canopy if you’re allowed)"
  ],
  notes: [
    "Screenshot your ticket + important info before service drops.",
    "Pick a meetup landmark early."
  ]
};

function setList(el, items){
  if(!el) return;
  el.innerHTML = (items || []).map(x => `<li>${x}</li>`).join("");
}

function renderEssentials(f){
  const e = f.essentials || {};

  const base = e.base || DEFAULT_ESSENTIALS.base;
  const weather = e.weather || DEFAULT_ESSENTIALS.weather;

  setList(document.getElementById("essBase"), base);
  setList(document.getElementById("essWeather"), weather);

  // Camping list conditional
  const campingCard = document.getElementById("essCampingCard");
  const campingEl = document.getElementById("essCamping");
  if(campingCard && campingEl){
    if(f.hasCamping){
      const camp = e.camping || DEFAULT_ESSENTIALS.camping;
      setList(campingEl, camp);
      campingCard.hidden = (camp || []).length === 0;
    } else {
      campingCard.hidden = true;
      campingEl.innerHTML = "";
    }
  }

  // Notes optional
  const notesCard = document.getElementById("essNotesCard");
  const notesEl = document.getElementById("essNotes");
  if(notesCard && notesEl){
    const notes = e.notes || DEFAULT_ESSENTIALS.notes;
    setList(notesEl, notes);
    notesCard.hidden = (notes || []).length === 0;
  }
}

/* =========================
   3) Daily Lineup (hidden unless data exists)
   Supports either:
   - lineup keyed by ISO dates: { "2026-04-10": { "Main Stage": [...] } }
   - or lineup keyed by day1/day2: { "day1": { ... } }
   ========================= */

function isISODateKey(k){
  return /^\d{4}-\d{2}-\d{2}$/.test(k);
}

function humanDateLabel(iso){
  try{
    const dt = parseDateISO(iso);
    return dt.toLocaleDateString(undefined, { weekday:"short", month:"short", day:"numeric" });
  } catch {
    return iso;
  }
}

function normalizeLineupKeys(lineupObj){
  if(!lineupObj || typeof lineupObj !== "object") return [];

  const keys = Object.keys(lineupObj);
  if(keys.length === 0) return [];

  const isoKeys = keys.filter(isISODateKey).sort((a,b)=> parseDateISO(a) - parseDateISO(b));
  if(isoKeys.length) return isoKeys;

  // fallback: day1/day2/day3 ordering
  const dayKeys = keys
    .filter(k => /^day\d+$/i.test(k))
    .sort((a,b)=> {
      const na = Number(a.replace(/day/i,""));
      const nb = Number(b.replace(/day/i,""));
      return na - nb;
    });

  return dayKeys.length ? dayKeys : keys.sort();
}

function renderLineup(f){
  const section = document.getElementById("lineupSection");
  const tabsEl = document.getElementById("lineupTabs");
  const daysEl = document.getElementById("lineupDays");
  if(!section || !tabsEl || !daysEl) return;

  const lineup = f.lineup;
  const dayKeys = normalizeLineupKeys(lineup);

  if(!lineup || dayKeys.length === 0){
    section.hidden = true;
    tabsEl.innerHTML = "";
    daysEl.innerHTML = "";
    return;
  }

  section.hidden = false;

  // Build tabs
  tabsEl.innerHTML = dayKeys.map((k, idx) => {
    const label = isISODateKey(k) ? humanDateLabel(k) : k.toUpperCase();
    return `<button class="lineup-tab" data-day="${k}" aria-selected="${idx===0 ? "true":"false"}">${label}</button>`;
  }).join("");

  // Build day panels
  daysEl.innerHTML = dayKeys.map((k, idx) => {
    const stages = lineup[k] || {};
    const stageNames = Object.keys(stages);

    const stageHTML = stageNames.map(stageName => {
      const slots = Array.isArray(stages[stageName]) ? stages[stageName] : [];
      const slotsHTML = slots.map(s => `
        <div class="slot">
          <div class="artist">${s.artist || ""}</div>
          <div class="time">${s.time || ""}</div>
        </div>
      `).join("");

      // collapsed by default for huge festivals; open first stage on first day
      const open = (idx === 0 && stageName === stageNames[0]);
      return `
        <div class="stage" data-open="${open ? "true":"false"}">
          <div class="stage-head" role="button" tabindex="0">
            <div class="stage-title">${stageName}</div>
            <div class="stage-toggle">${open ? "Hide" : "Show"}</div>
          </div>
          <div class="stage-body" style="display:${open ? "block":"none"}">
            ${slotsHTML || `<div class="slot"><div class="artist">Schedule TBD</div><div class="time"></div></div>`}
          </div>
        </div>
      `;
    }).join("");

    const fallback = stageNames.length ? stageHTML : `<div class="stage"><div class="stage-body">Schedule TBD</div></div>`;

    return `<div class="lineup-day ${idx===0 ? "active":""}" data-day="${k}">${fallback}</div>`;
  }).join("");

  // Tab interactions
  const setActiveDay = (key)=>{
    // tabs
    tabsEl.querySelectorAll(".lineup-tab").forEach(btn=>{
      btn.setAttribute("aria-selected", btn.dataset.day === key ? "true" : "false");
    });
    // panels
    daysEl.querySelectorAll(".lineup-day").forEach(p=>{
      p.classList.toggle("active", p.dataset.day === key);
    });
  };

  tabsEl.querySelectorAll(".lineup-tab").forEach(btn=>{
    btn.addEventListener("click", ()=> setActiveDay(btn.dataset.day));
  });

  // Stage collapse/expand
  daysEl.querySelectorAll(".stage").forEach(stage=>{
    const head = stage.querySelector(".stage-head");
    const body = stage.querySelector(".stage-body");
    const toggle = stage.querySelector(".stage-toggle");
    const flip = ()=>{
      const isOpen = body.style.display !== "none";
      body.style.display = isOpen ? "none" : "block";
      toggle.textContent = isOpen ? "Show" : "Hide";
    };
    head.addEventListener("click", flip);
    head.addEventListener("keydown", (e)=>{
      if(e.key === "Enter" || e.key === " "){
        e.preventDefault();
        flip();
      }
    });
  });
}

/* =========================
   Init
   ========================= */

async function init(){
  const id = qs("festival");
  if(!id){
    document.getElementById("festivalTitle").textContent = "FESTIVAL";
    document.getElementById("festivalName").textContent = "Missing festival id";
    return;
  }

  const res = await fetch(DATA_URL, { cache:"no-store" });
  const list = await res.json();
  const f = list.find(x => x.id === id);

  if(!f){
    document.getElementById("festivalTitle").textContent = "FESTIVAL";
    document.getElementById("festivalName").textContent = "Festival not found";
    document.getElementById("festivalMeta").textContent = "Check the URL id.";
    return;
  }

  document.title = `Concerto — ${f.name}`;
  document.getElementById("festivalTitle").textContent = "FESTIVAL";
  document.getElementById("festivalName").textContent = f.name;

  const loc = `${f.city}${f.state ? ", " + f.state : ""}${f.country ? " • " + f.country : ""}`;
  document.getElementById("festivalMeta").textContent = formatRange(f);
  document.getElementById("festivalSub").textContent = `${loc} • ${f.venue}`;

  document.getElementById("datesVal").textContent = formatRange(f);
  document.getElementById("locVal").textContent = `${f.city}${f.state ? ", " + f.state : ""}`;
  document.getElementById("genresVal").textContent = (f.genres || []).join(", ") || "—";
  document.getElementById("campVal").textContent = f.hasCamping ? "Yes" : "No";

  const officialBtn = document.getElementById("officialBtn");
  officialBtn.href = f.officialUrl || f.ticketUrl || "#";
  officialBtn.style.pointerEvents = (officialBtn.href === "#") ? "none" : "auto";
  officialBtn.style.opacity = (officialBtn.href === "#") ? "0.5" : "1";

  const ticketsBtn = document.getElementById("ticketsBtn");
  ticketsBtn.href = f.ticketUrl || f.officialUrl || "#";
  ticketsBtn.style.pointerEvents = (ticketsBtn.href === "#") ? "none" : "auto";
  ticketsBtn.style.opacity = (ticketsBtn.href === "#") ? "0.5" : "1";

// City Guide link (canonical)
const cityGuideBtn = document.getElementById("cityGuideBtn");
const CITY_GUIDE_BASE = "https://concerto-venue-map.netlify.app/";

const lat = f.coordinates?.lat;
const lng = f.coordinates?.lng;

// Prefer coordinates (best for festivals)
if (typeof lat === "number" && typeof lng === "number") {
  cityGuideBtn.href = `${CITY_GUIDE_BASE}?lat=${lat}&lng=${lng}&venue=${encodeURIComponent(f.name)}`;
  cityGuideBtn.style.pointerEvents = "auto";
  cityGuideBtn.style.opacity = "1";
}
// Fallback: old key-based links if you ever have them
else if (f.cityGuideVenueKey) {
  cityGuideBtn.href = `${CITY_GUIDE_BASE}?venue=${encodeURIComponent(f.cityGuideVenueKey)}`;
  cityGuideBtn.style.pointerEvents = "auto";
  cityGuideBtn.style.opacity = "1";
}
else {
  cityGuideBtn.href = "#";
  cityGuideBtn.style.pointerEvents = "none";
  cityGuideBtn.style.opacity = "0.5";
}

  const aiBtn = document.getElementById("aiBtn");
  aiBtn.href = `#`;
  aiBtn.style.pointerEvents = "none";
  aiBtn.style.opacity = "0.5";

  // NEW: Guided Festival Layer
  renderArrival(f);
  renderEssentials(f);
  renderLineup(f);
}

init().catch(console.error);
