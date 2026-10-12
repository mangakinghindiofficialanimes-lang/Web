const titles = [
  {id:"skybound",name:"Skybound Legends",genre:"Adventure",year:"2026",type:"Series",symbol:"SL",color:"linear-gradient(135deg,#30235d,#6c4d9f 50%,#ed9fce)",description:"A young explorer follows a trail of floating islands and discovers that every legend has a beginning.",tags:["Adventure","Fantasy"],status:"Library preview"},
  {id:"neon",name:"Neon Ronin",genre:"Action",year:"2025",type:"Series",symbol:"NR",color:"linear-gradient(135deg,#112c49,#126f83 55%,#ab7de3)",description:"In a city that never sleeps, a quiet swordsman searches for the truth behind a mysterious signal.",tags:["Action","Drama"],status:"Library preview"},
  {id:"moonlit",name:"Moonlit Academy",genre:"Fantasy",year:"2026",type:"Series",symbol:"MA",color:"linear-gradient(135deg,#382051,#8758a8 52%,#f1b5c9)",description:"An unexpected invitation brings a new student to a school where the stars seem a little too close.",tags:["Fantasy","Drama"],status:"Library preview"},
  {id:"wild",name:"Wild Horizon",genre:"Adventure",year:"2024",type:"Series",symbol:"WH",color:"linear-gradient(135deg,#183f3a,#398c75 52%,#d7c881)",description:"A crew of friends sets out across a vast frontier, chasing a map that no one believes is real.",tags:["Adventure","Action"],status:"Library preview"},
  {id:"echo",name:"Echoes of Tomorrow",genre:"Drama",year:"2025",type:"Movie",symbol:"ET",color:"linear-gradient(135deg,#29284e,#6a74a7 55%,#d5b3e5)",description:"A thoughtful story about friendship, choices, and the small moments that shape the future.",tags:["Drama","Fantasy"],status:"Library preview"},
  {id:"ember",name:"Ember Knights",genre:"Action",year:"2026",type:"Series",symbol:"EK",color:"linear-gradient(135deg,#51252e,#b9584c 55%,#efbd8d)",description:"A new generation of guardians learns that courage means more than winning a battle.",tags:["Action","Fantasy"],status:"Library preview"}
];
let activeFilter = "All";
const grid = document.getElementById("animeGrid");
const searchInput = document.getElementById("searchInput");
const count = document.getElementById("resultCount");
const empty = document.getElementById("emptyState");
const dialog = document.getElementById("animeDialog");
const toast = document.getElementById("toast");
let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}
function escapeText(value) {
  return String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}
function renderCards() {
  const query = searchInput.value.trim().toLowerCase();
  const visible = titles.filter(item => {
    const matchesFilter = activeFilter === "All" || item.tags.includes(activeFilter);
    const matchesQuery = (item.name + " " + item.genre + " " + item.description).toLowerCase().includes(query);
    return matchesFilter && matchesQuery;
  });
  count.textContent = visible.length;
  empty.classList.toggle("hidden", visible.length !== 0);
  grid.classList.toggle("hidden", visible.length === 0);
  grid.innerHTML = visible.map((item, index) => '<article class="anime-card">' +
    '<div class="cover" style="--cover:' + item.color + '">' +
    '<span class="cover-number">N/A · ' + String(index + 1).padStart(2, "0") + '</span>' +
    '<span class="cover-status">PREVIEW</span><span class="cover-symbol">' + escapeText(item.symbol) + '</span></div>' +
    '<div class="card-body"><div class="card-topline"><span class="card-genre">' + escapeText(item.genre) + '</span><span class="card-year">' + escapeText(item.year) + '</span></div>' +
    '<h3>' + escapeText(item.name) + '</h3><p>' + escapeText(item.description) + '</p>' +
    '<div class="card-footer"><span class="card-type">' + escapeText(item.type) + ' · Sample</span><button class="details-button" data-id="' + escapeText(item.id) + '">View details <span>↗</span></button></div></div></article>').join("");
}
function openDetails(id) {
  const item = titles.find(entry => entry.id === id);
  if (!item) return;
  document.getElementById("dialogArt").style.setProperty("--cover", item.color);
  document.getElementById("dialogSymbol").textContent = item.symbol;
  document.getElementById("dialogGenre").textContent = item.genre.toUpperCase() + " · SAMPLE TITLE";
  document.getElementById("dialogTitle").textContent = item.name;
  document.getElementById("dialogDescription").textContent = item.description;
  document.getElementById("dialogMeta").innerHTML = [item.year, item.type, "Demo catalogue"].map(value => "<span>" + escapeText(value) + "</span>").join("");
  document.getElementById("episodeArea").innerHTML = "<h3>Episodes & video sources</h3><p class=\"source-note\">This is a sample catalogue entry. Add a video URL only if you own the video or have permission to stream it. No episode source is configured here.</p>";
  dialog.showModal();
}
grid.addEventListener("click", event => {
  const button = event.target.closest("[data-id]");
  if (button) openDetails(button.dataset.id);
});
searchInput.addEventListener("input", renderCards);
document.getElementById("filters").addEventListener("click", event => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  activeFilter = button.dataset.filter;
  document.querySelectorAll(".filter-chip").forEach(chip => chip.classList.toggle("selected", chip === button));
  renderCards();
});
document.getElementById("resetFilters").addEventListener("click", () => {
  activeFilter = "All";
  searchInput.value = "";
  document.querySelectorAll(".filter-chip").forEach(chip => chip.classList.toggle("selected", chip.dataset.filter === "All"));
  renderCards();
});
document.getElementById("closeDialog").addEventListener("click", () => dialog.close());
document.getElementById("dialogOk").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
document.getElementById("themeHint").addEventListener("click", () => showToast("NITIN ANIMES is a work in progress. Only authorised video sources should be added."));
document.addEventListener("keydown", event => {
  if (event.key === "/" && !["INPUT","TEXTAREA"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    searchInput.focus();
  }
});
renderCards();