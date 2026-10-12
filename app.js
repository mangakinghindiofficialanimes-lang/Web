const sampleTitles = [
  {id:"sample-skybound",title:"Skybound Legends",genre:"Adventure",release_year:2026,type:"Series",symbol:"SL",cover_url:"",status:"published",synopsis:"A young explorer follows a trail of floating islands and discovers that every legend has a beginning.",tags:["Adventure","Fantasy"],demo:true,color:"linear-gradient(135deg,#30235d,#6c4d9f 50%,#ed9fce)"},
  {id:"sample-neon",title:"Neon Ronin",genre:"Action",release_year:2025,type:"Series",symbol:"NR",cover_url:"",status:"published",synopsis:"In a city that never sleeps, a quiet swordsman searches for the truth behind a mysterious signal.",tags:["Action","Drama"],demo:true,color:"linear-gradient(135deg,#112c49,#126f83 55%,#ab7de3)"},
  {id:"sample-moonlit",title:"Moonlit Academy",genre:"Fantasy",release_year:2026,type:"Series",symbol:"MA",cover_url:"",status:"published",synopsis:"An unexpected invitation brings a new student to a school where the stars seem a little too close.",tags:["Fantasy","Drama"],demo:true,color:"linear-gradient(135deg,#382051,#8758a8 52%,#f1b5c9)"},
  {id:"sample-wild",title:"Wild Horizon",genre:"Adventure",release_year:2024,type:"Series",symbol:"WH",cover_url:"",status:"published",synopsis:"A crew of friends sets out across a vast frontier, chasing a map that no one believes is real.",tags:["Adventure","Action"],demo:true,color:"linear-gradient(135deg,#183f3a,#398c75 52%,#d7c881)"},
  {id:"sample-echo",title:"Echoes of Tomorrow",genre:"Drama",release_year:2025,type:"Movie",symbol:"ET",cover_url:"",status:"published",synopsis:"A thoughtful story about friendship, choices, and the small moments that shape the future.",tags:["Drama","Fantasy"],demo:true,color:"linear-gradient(135deg,#29284e,#6a74a7 55%,#d5b3e5)"},
  {id:"sample-ember",title:"Ember Knights",genre:"Action",release_year:2026,type:"Series",symbol:"EK",cover_url:"",status:"published",synopsis:"A new generation of guardians learns that courage means more than winning a battle.",tags:["Action","Fantasy"],demo:true,color:"linear-gradient(135deg,#51252e,#b9584c 55%,#efbd8d)"}
];
let titles = sampleTitles.slice();
let activeFilter = "All";
let supabaseClient = null;
const configured = window.NITIN_SUPABASE && window.NITIN_SUPABASE.url && window.NITIN_SUPABASE.anonKey &&
  !window.NITIN_SUPABASE.url.includes("YOUR_PROJECT") && !window.NITIN_SUPABASE.anonKey.includes("YOUR_PUBLIC");
if (configured && window.supabase) {
  supabaseClient = window.supabase.createClient(window.NITIN_SUPABASE.url, window.NITIN_SUPABASE.anonKey);
}
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
  return String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}
function safeHttpUrl(value) {
  try { const url = new URL(value); return ["https:","http:"].includes(url.protocol) ? url.href : ""; }
  catch { return ""; }
}
function symbolFor(item) {
  return (item.title || "NA").split(/\s+/).slice(0,2).map(word => word[0]).join("").toUpperCase();
}
function itemColor(item, index=0) {
  if (item.color) return item.color;
  const colors = ["linear-gradient(135deg,#30235d,#6c4d9f 50%,#ed9fce)","linear-gradient(135deg,#112c49,#126f83 55%,#ab7de3)","linear-gradient(135deg,#382051,#8758a8 52%,#f1b5c9)","linear-gradient(135deg,#183f3a,#398c75 52%,#d7c881)","linear-gradient(135deg,#29284e,#6a74a7 55%,#d5b3e5)","linear-gradient(135deg,#51252e,#b9584c 55%,#efbd8d)"];
  return colors[index % colors.length];
}
function renderCards() {
  const query = searchInput.value.trim().toLowerCase();
  const visible = titles.filter(item => {
    const tags = Array.isArray(item.tags) ? item.tags : [item.genre || ""];
    return (activeFilter === "All" || tags.includes(activeFilter) || item.genre === activeFilter) &&
      ((item.title + " " + item.genre + " " + item.synopsis).toLowerCase().includes(query));
  });
  count.textContent = visible.length;
  empty.classList.toggle("hidden", visible.length !== 0);
  grid.classList.toggle("hidden", visible.length === 0);
  grid.innerHTML = visible.map((item, index) => {
    const cover = safeHttpUrl(item.cover_url);
    const coverMarkup = cover
      ? '<img src="' + escapeText(cover) + '" alt="" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">'
      : '<span class="cover-symbol">' + escapeText(item.symbol || symbolFor(item)) + '</span>';
    return '<article class="anime-card"><div class="cover" style="--cover:' + itemColor(item,index) + '">' +
      '<span class="cover-number">N/A · ' + String(index + 1).padStart(2, "0") + '</span>' +
      '<span class="cover-status">' + (item.demo ? "SAMPLE" : "CATALOGUE") + '</span>' + coverMarkup + '</div>' +
      '<div class="card-body"><div class="card-topline"><span class="card-genre">' + escapeText(item.genre || "Anime") + '</span><span class="card-year">' + escapeText(item.release_year || "—") + '</span></div>' +
      '<h3>' + escapeText(item.title) + '</h3><p>' + escapeText(item.synopsis || "More information coming soon.") + '</p>' +
      '<div class="card-footer"><span class="card-type">' + escapeText(item.type || "Series") + '</span><button class="details-button" data-id="' + escapeText(item.id) + '">View details <span>↗</span></button></div></div></article>';
  }).join("");
}
async function loadCatalogue() {
  if (!supabaseClient) { renderCards(); return; }
  const {data,error} = await supabaseClient.from("anime").select("id,title,synopsis,genre,release_year,cover_url,status").eq("status","published").order("created_at",{ascending:false});
  if (error) { console.warn("Catalogue load failed; showing demo catalogue.", error.message); renderCards(); return; }
  titles = (data || []).map(item => ({...item, type:"Series", tags:[item.genre], demo:false}));
  if (!titles.length) titles = sampleTitles.slice();
  renderCards();
}
async function openDetails(id) {
  const item = titles.find(entry => entry.id === id);
  if (!item) return;
  document.getElementById("dialogArt").style.setProperty("--cover", itemColor(item));
  const art = document.getElementById("dialogArt");
  art.innerHTML = '<span id="dialogSymbol">' + escapeText(item.symbol || symbolFor(item)) + '</span>';
  const cover = safeHttpUrl(item.cover_url);
  if (cover) art.innerHTML = '<img src="' + escapeText(cover) + '" alt="" style="width:100%;height:100%;object-fit:cover">';
  document.getElementById("dialogGenre").textContent = (item.genre || "ANIME").toUpperCase() + (item.demo ? " · SAMPLE TITLE" : "");
  document.getElementById("dialogTitle").textContent = item.title;
  document.getElementById("dialogDescription").textContent = item.synopsis || "More information coming soon.";
  document.getElementById("dialogMeta").innerHTML = [item.release_year || "Year not set", item.type || "Series", item.demo ? "Demo catalogue" : "Catalogue"].map(value => "<span>" + escapeText(value) + "</span>").join("");
  const episodeArea = document.getElementById("episodeArea");
  episodeArea.innerHTML = "<h3>Episodes & video sources</h3><p class=\"source-note\">Loading episodes…</p>";
  dialog.showModal();
  if (!supabaseClient || item.demo) {
    episodeArea.innerHTML = "<h3>Episodes & video sources</h3><p class=\"source-note\">This is a sample catalogue entry. Add a video URL only if you own the video or have permission to stream it. No episode source is configured here.</p>";
    return;
  }
  const {data,error} = await supabaseClient.from("episodes").select("id,title,episode_number,video_url,download_url").eq("anime_id",item.id).eq("is_published",true).order("episode_number");
  if (error) {
    episodeArea.innerHTML = "<h3>Episodes & video sources</h3><p class=\"source-note\">Episode list could not be loaded. Please try again later.</p>";
    return;
  }
  if (!data?.length) {
    episodeArea.innerHTML = "<h3>Episodes & video sources</h3><p class=\"source-note\">No published episodes are available yet.</p>";
    return;
  }
  episodeArea.innerHTML = "<h3>Episodes</h3><div class=\"episode-list\">" + data.map(ep => {
    const video = safeHttpUrl(ep.video_url);
    const download = safeHttpUrl(ep.download_url);
    return '<div class="episode-row"><div><b>' + escapeText("EP " + ep.episode_number + " · " + ep.title) + '</b><small>' + (video ? "Video source available" : "No video source") + '</small></div>' +
      (video ? '<button class="secondary-button episode-play" data-video="' + escapeText(video) + '" data-episode="' + escapeText(ep.id) + '">Play</button>' : '') +
      (download ? '<a class="secondary-button" href="' + escapeText(download) + '" target="_blank" rel="noopener noreferrer">Download</a>' : '') + '</div>';
  }).join("") + '<div id="playerMount"></div></div>';
  episodeArea.querySelectorAll(".episode-play").forEach(button => button.addEventListener("click", async () => {
    const mount = document.getElementById("playerMount");
    mount.innerHTML = '<video controls playsinline preload="metadata" style="width:100%;margin-top:12px;border-radius:12px;background:#000" src="' + escapeText(button.dataset.video) + '">Your browser does not support HTML video.</video>';
    const {data:{user}} = await supabaseClient.auth.getUser();
    await supabaseClient.from("watch_events").insert({user_id:user?.id || null, anime_id:item.id, episode_id:button.dataset.episode, event_type:"play"});
  }));
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
  activeFilter = "All"; searchInput.value = "";
  document.querySelectorAll(".filter-chip").forEach(chip => chip.classList.toggle("selected", chip.dataset.filter === "All"));
  renderCards();
});
document.getElementById("closeDialog").addEventListener("click", () => dialog.close());
document.getElementById("dialogOk").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
document.getElementById("themeHint").addEventListener("click", () => showToast("Only add videos and downloads you own or are licensed to distribute."));
document.addEventListener("keydown", event => {
  if (event.key === "/" && !["INPUT","TEXTAREA"].includes(document.activeElement.tagName)) { event.preventDefault(); searchInput.focus(); }
});
loadCatalogue();