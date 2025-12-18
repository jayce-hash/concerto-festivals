const DATA_URL = "data/festivals.json";

const grid = document.getElementById("grid");
const q = document.getElementById("q");
const month = document.getElementById("month");
const genre = document.getElementById("genre");
const countLabel = document.getElementById("countLabel");
const emptyState = document.getElementById("emptyState");
const clearBtn = document.getElementById("clearBtn");
const sortBtn = document.getElementById("sortBtn");
const quickChips = document.getElementById("quickChips");

const modal = document.getElementById("modal");
const openHelp = document.getElementById("openHelp");
const modalClose = document.getElementById("modalClose");
const modalOk = document.getElementById("modalOk");

let festivals = [];
let sortMode = "soonest";

function parseDateISO(s){
  // expects YYYY-MM-DD
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

function monthKey(dateISO){
  const dt = parseDateISO(dateISO);
  const mo = dt.toLocaleDateString(undefined, { month:"long" });
  return `${mo}`;
}

function uniq(arr){ return [...new Set(arr)].filter(Boolean); }

function buildFilters(list){
  const months = uniq(list.map(f => monthKey(f.startDate)));
  months.sort((a,b)=> new Date(`${a} 1, 2000`) - new Date(`${b} 1, 2000`));
  month.innerHTML = `<option value="all">All months</option>` +
    months.map(m => `<option value="${m}">${m}</option>`).join("");

  const genres = uniq(list.flatMap(f => f.genres || [])).sort((a,b)=>a.localeCompare(b));
  genre.innerHTML = `<option value="all">All genres</option>` +
    genres.map(g => `<option value="${g}">${g}</option>`).join("");

  // quick chips (common intents)
  const chips = ["EDM", "Hip-Hop", "Pop", "Rock", "Country", "Indie"];
  quickChips.innerHTML = chips.map(c => `<button class="chip" data-chip="${c}">${c}</button>`).join("");
  quickChips.querySelectorAll("[data-chip]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      genre.value = btn.dataset.chip;
      render();
    });
  });
}

function matchesSearch(f, term){
  if(!term) return true;
  const t = term.toLowerCase().trim();
  const hay = [
    f.name, f.city, f.state, f.country, f.venue,
    ...(f.genres || [])
  ].join(" ").toLowerCase();
  return hay.includes(t);
}

function matchesMonth(f, m){
  if(m === "all") return true;
  return monthKey(f.startDate) === m;
}

function matchesGenre(f, g){
  if(g === "all") return true;
  return (f.genres || []).includes(g);
}

function sortList(list){
  const copy = [...list];
  if(sortMode === "soonest"){
    copy.sort((a,b)=> parseDateISO(a.startDate) - parseDateISO(b.startDate));
  } else if(sortMode === "name"){
    copy.sort((a,b)=> a.name.localeCompare(b.name));
  }
  return copy;
}

function cardHTML(f){
  const kicker = formatRange(f);
  const sub = `${f.city}${f.state ? ", " + f.state : ""}`;
  const tags = (f.genres || []).slice(0,3).map(g => `<span class="tag">${g}</span>`).join("");
  return `
    <div class="card" data-id="${f.id}" role="button" tabindex="0">
      <div class="card-kicker">${kicker}</div>
      <div class="card-title">${f.name}</div>
      <p class="card-sub">${sub} • ${f.venue}</p>
      <div class="tags">${tags}</div>
    </div>
  `;
}

function render(){
  const term = q.value || "";
  const m = month.value;
  const g = genre.value;

  let filtered = festivals.filter(f =>
    matchesSearch(f, term) && matchesMonth(f, m) && matchesGenre(f, g)
  );

  filtered = sortList(filtered);

  countLabel.textContent = `${filtered.length} festival${filtered.length===1?"":"s"} shown`;
  grid.innerHTML = filtered.map(cardHTML).join("");
  emptyState.hidden = filtered.length !== 0;

  grid.querySelectorAll(".card").forEach(card=>{
    const open = ()=>{
      const id = card.dataset.id;
      window.location.href = `festival.html?festival=${encodeURIComponent(id)}`;
    };
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e)=>{
      if(e.key === "Enter" || e.key === " ") open();
    });
  });
}

function toggleSort(){
  if(sortMode === "soonest"){
    sortMode = "name";
    sortBtn.textContent = "Sort: Name";
  } else {
    sortMode = "soonest";
    sortBtn.textContent = "Sort: Soonest";
  }
  render();
}

function openModal(){
  modal.hidden = false;
}
function closeModal(){
  modal.hidden = true;
}

async function init(){
  const res = await fetch(DATA_URL, { cache: "no-store" });
  festivals = await res.json();

  buildFilters(festivals);

  q.addEventListener("input", render);
  month.addEventListener("change", render);
  genre.addEventListener("change", render);

  clearBtn.addEventListener("click", ()=>{
    q.value = "";
    q.focus();
    render();
  });

  sortBtn.addEventListener("click", toggleSort);

  openHelp.addEventListener("click", (e)=>{ e.preventDefault(); openModal(); });
  modalClose.addEventListener("click", closeModal);
  modalOk.addEventListener("click", closeModal);

  render();
}

init().catch(err=>{
  console.error(err);
  countLabel.textContent = "Couldn’t load festivals.json";
});
