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
   3) Daily Lineup + Stars + My Day
   Supports lineup keyed by:
   - ISO dates: { "2026-04-10": { "Main Stage": [...] } }
   - or day1/day2: { "day1": { ... } }
   Slot format: { artist: "", time: "" }
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

  const dayKeys = keys
    .filter(k => /^day\d+$/i.test(k))
    .sort((a,b)=> {
      const na = Number(a.replace(/day/i,""));
      const nb = Number(b.replace(/day/i,""));
      return na - nb;
    });

  return dayKeys.length ? dayKeys : keys.sort();
}

function parseTimeToMinutes(t){
  // Supports "6:45 PM" / "6 PM" / "18:45"
  if(!t) return null;
  const s = String(t).trim();

  // 24h "18:45"
  const m24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if(m24){
    const hh = Number(m24[1]), mm = Number(m24[2]);
    if(Number.isFinite(hh) && Number.isFinite(mm)) return hh*60+mm;
  }

  // 12h "6:45 PM" or "6 PM"
  const m12 = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if(m12){
    let hh = Number(m12[1]);
    const mm = Number(m12[2] ?? "0");
    const ap = m12[3].toUpperCase();
    if(ap === "PM" && hh !== 12) hh += 12;
    if(ap === "AM" && hh === 12) hh = 0;
    return hh*60+mm;
  }

  return null;
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

  const SAVE_KEY = `concerto_fest_saved_${f.id}`;

  function loadSaved(){
    try { return new Set(JSON.parse(localStorage.getItem(SAVE_KEY) || "[]")); }
    catch { return new Set(); }
  }
  function saveSaved(set){
    localStorage.setItem(SAVE_KEY, JSON.stringify([...set]));
  }
  function makeSlotKey(dayKey, stageName, slot){
    return [f.id, dayKey, stageName, (slot.artist||""), (slot.time||"")].join("|");
  }

  const saved = loadSaved();

  // Build My Day list from current lineup (only saved entries that still exist)
  const allSlots = [];
  dayKeys.forEach((dayKey, dayIndex)=>{
    const stages = lineup[dayKey] || {};
    Object.keys(stages).forEach(stageName=>{
      const slots = Array.isArray(stages[stageName]) ? stages[stageName] : [];
      slots.forEach(slot=>{
        const key = makeSlotKey(dayKey, stageName, slot);
        allSlots.push({
          key,
          dayKey,
          dayIndex,
          stageName,
          artist: slot.artist || "",
          time: slot.time || "",
          minutes: parseTimeToMinutes(slot.time)
        });
      });
    });
  });

  const myDayItems = allSlots
    .filter(x => saved.has(x.key))
    .sort((a,b)=>{
      if(a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
      const am = a.minutes ?? 9999;
      const bm = b.minutes ?? 9999;
      if(am !== bm) return am - bm;
      return (a.artist || "").localeCompare(b.artist || "");
    });

  const showMyDay = myDayItems.length > 0;

  // Tabs: day tabs + My Day
  const tabModels = [
    ...dayKeys.map((k)=>({
      key: k,
      label: isISODateKey(k) ? humanDateLabel(k) : k.toUpperCase()
    })),
    ...(showMyDay ? [{ key: "__myday__", label: "My Day" }] : [])
  ];

  tabsEl.innerHTML = tabModels.map((t, idx) => {
    return `<button class="lineup-tab" data-day="${t.key}" aria-selected="${idx===0 ? "true":"false"}">${t.label}</button>`;
  }).join("");

  // Day panels
  const dayPanelsHTML = dayKeys.map((dayKey, idx) => {
    const stages = lineup[dayKey] || {};
    const stageNames = Object.keys(stages);

    const stageHTML = stageNames.map(stageName => {
      const slots = Array.isArray(stages[stageName]) ? stages[stageName] : [];

      const slotsHTML = slots.map(slot => {
        const key = makeSlotKey(dayKey, stageName, slot);
        const isSaved = saved.has(key);

        return `
          <div class="slot" data-key="${key}">
            <div class="time">${slot.time || ""}</div>
            <div class="artist">${slot.artist || ""}</div>
            <div class="meta">
              <button class="star-btn" type="button" aria-label="Save" aria-pressed="${isSaved ? "true" : "false"}">
                ${isSaved ? "★" : "☆"}
              </button>
            </div>
          </div>
        `;
      }).join("");

      const open = (idx === 0 && stageName === stageNames[0]);
      return `
        <div class="stage">
          <div class="stage-head" role="button" tabindex="0">
            <div class="stage-title">${stageName}</div>
            <div class="stage-toggle">${open ? "Hide" : "Show"}</div>
          </div>
          <div class="stage-body" style="display:${open ? "block":"none"}">
            ${slotsHTML || `<div class="slot"><div class="artist">Schedule TBD</div><div class="time"></div><div class="meta"></div></div>`}
          </div>
        </div>
      `;
    }).join("");

    const fallback = stageNames.length
      ? stageHTML
      : `<div class="stage"><div class="stage-body">Schedule TBD</div></div>`;

    return `<div class="lineup-day ${idx===0 ? "active":""}" data-day="${dayKey}">${fallback}</div>`;
  }).join("");

  // My Day panel
  const myDayHTML = showMyDay ? `
    <div class="lineup-day" data-day="__myday__">
      <div class="stage" style="margin-bottom:10px">
        <div class="stage-head" style="cursor:default" tabindex="-1">
          <div class="stage-title">Saved sets</div>
          <div class="stage-toggle"></div>
        </div>
        <div class="stage-body" style="display:block">
          ${myDayItems.map(item => `
            <div class="slot" data-key="${item.key}">
              <div class="time">${item.time || ""}</div>
              <div class="artist">${item.artist || ""} <span style="opacity:.7">• ${item.stageName}</span></div>
              <div class="meta">
                <button class="star-btn" type="button" aria-label="Unsave" aria-pressed="true">★</button>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
  ` : "";

  daysEl.innerHTML = dayPanelsHTML + myDayHTML;

  // Tab interactions
  const setActiveDay = (key)=>{
    tabsEl.querySelectorAll(".lineup-tab").forEach(btn=>{
      btn.setAttribute("aria-selected", btn.dataset.day === key ? "true" : "false");
    });
    daysEl.querySelectorAll(".lineup-day").forEach(p=>{
      p.classList.toggle("active", p.dataset.day === key);
    });
  };

  tabsEl.querySelectorAll(".lineup-tab").forEach(btn=>{
    btn.addEventListener("click", ()=> setActiveDay(btn.dataset.day));
  });

  // Stage collapse/expand (day panels only)
  daysEl.querySelectorAll(".lineup-day").forEach(dayPanel=>{
    if(dayPanel.dataset.day === "__myday__") return;

    dayPanel.querySelectorAll(".stage").forEach(stage=>{
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
  });

  // Star click (bind once)
  if(!daysEl.dataset.starBound){
    daysEl.dataset.starBound = "true";
    daysEl.addEventListener("click", (e)=>{
      const star = e.target.closest(".star-btn");
      if(!star) return;

      const slotEl = star.closest(".slot");
      const key = slotEl?.dataset?.key;
      if(!key) return;

      const current = loadSaved();
      if(current.has(key)) current.delete(key);
      else current.add(key);
      saveSaved(current);

      // Re-render lineup to update stars + My Day tab
      renderLineup(f);

      // Keep user on My Day if they were on it
      const activeTab = tabsEl.querySelector('.lineup-tab[aria-selected="true"]')?.dataset?.day;
      if(activeTab === "__myday__"){
        setActiveDay("__myday__");
      }
    });
  }
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

  if (typeof lat === "number" && typeof lng === "number") {
    cityGuideBtn.href = `${CITY_GUIDE_BASE}?lat=${lat}&lng=${lng}&venue=${encodeURIComponent(f.name)}`;
    cityGuideBtn.style.pointerEvents = "auto";
    cityGuideBtn.style.opacity = "1";
  } else if (f.cityGuideVenueKey) {
    cityGuideBtn.href = `${CITY_GUIDE_BASE}?venue=${encodeURIComponent(f.cityGuideVenueKey)}`;
    cityGuideBtn.style.pointerEvents = "auto";
    cityGuideBtn.style.opacity = "1";
  } else {
    cityGuideBtn.href = "#";
    cityGuideBtn.style.pointerEvents = "none";
    cityGuideBtn.style.opacity = "0.5";
  }

  const aiBtn = document.getElementById("aiBtn");
  aiBtn.href = `#`;
  aiBtn.style.pointerEvents = "none";
  aiBtn.style.opacity = "0.5";

  // Guided Festival Layer
  renderArrival(f);
  renderEssentials(f);
  renderLineup(f);
}

init().catch(console.error);
