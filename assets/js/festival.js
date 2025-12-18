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

  // City Guide link (your universal link pattern)
  const cityGuideBtn = document.getElementById("cityGuideBtn");
  if(f.cityGuideVenueKey){
    cityGuideBtn.href = `https://concerto-venue-map.netlify.app/?venue=${encodeURIComponent(f.cityGuideVenueKey)}`;
  } else {
    cityGuideBtn.href = "#";
    cityGuideBtn.style.pointerEvents = "none";
    cityGuideBtn.style.opacity = "0.5";
  }

  // AI Planner (placeholder route — swap later to your real planner deploy)
  const aiBtn = document.getElementById("aiBtn");
  aiBtn.href = `#`;
  aiBtn.style.pointerEvents = "none";
  aiBtn.style.opacity = "0.5";
}

init().catch(console.error);
