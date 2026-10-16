(() => {
  const $ = id => document.getElementById(id);
  const form = $("loginForm"), message = $("authMessage"), warning = $("configWarning");
  const loginCard = $("loginCard"), dashboard = $("dashboard");
  const configured = window.NITIN_SUPABASE && window.NITIN_SUPABASE.url && window.NITIN_SUPABASE.anonKey &&
    !window.NITIN_SUPABASE.url.includes("YOUR_PROJECT") && !window.NITIN_SUPABASE.anonKey.includes("YOUR_PUBLIC");
  let client = null, currentUser = null, animeRows = [], episodeRows = [], profileRows = [];
  if (!configured || !window.supabase) { form.querySelector("button").disabled = true; message.textContent = "Supabase is not configured yet."; return; }
  warning.classList.add("hidden");
  client = window.supabase.createClient(window.NITIN_SUPABASE.url, window.NITIN_SUPABASE.anonKey);
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const safeUrl = value => { try { const u = new URL(value); return ["https:","http:"].includes(u.protocol) ? u.href : ""; } catch { return ""; } };
  function notice(text, isError=false) { const el=$("adminNotice"); el.textContent=text; el.classList.remove("hidden"); el.style.borderColor=isError?"#f87171":"#a78bfa66"; }
  function clearNotice(){ $("adminNotice").classList.add("hidden"); }
  function setBusy(button, busy, label) { button.disabled=busy; if (busy) { button.dataset.oldLabel=button.textContent; button.textContent=label||"Working…"; } else if(button.dataset.oldLabel){button.textContent=button.dataset.oldLabel;delete button.dataset.oldLabel;} }
  async function invokeAdmin(action, payload={}) {
    const {data,error}=await client.functions.invoke("manage-users",{body:{action,...payload}});
    if(error) throw new Error(error.message || "Admin function request failed.");
    if(data?.error) throw new Error(data.error);
    return data;
  }
  async function checkAdmin(user) {
    const {data,error}=await client.from("profiles").select("role").eq("id",user.id).maybeSingle();
    if(error || !data || data.role!=="admin") { await client.auth.signOut(); message.textContent="This account is not authorised as an admin. Grant the admin role in Supabase SQL Editor."; return false; }
    currentUser=user; $("adminEmail").textContent=user.email||"Admin"; loginCard.classList.add("hidden"); dashboard.classList.remove("hidden"); clearNotice(); await refreshAll(); return true;
  }
  form.addEventListener("submit",async event=>{event.preventDefault();message.textContent="Signing in…";const {data,error}=await client.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});if(error){message.textContent=error.message;return;}await checkAdmin(data.user);});
  $("signOutButton").addEventListener("click",async()=>{await client.auth.signOut();currentUser=null;dashboard.classList.add("hidden");loginCard.classList.remove("hidden");form.reset();$("adminEmail").textContent="";message.textContent="Signed out.";});
  async function refreshAll(){clearNotice();await Promise.all([loadAnime(),loadEpisodes(),loadUsers(),loadAnalytics()]);updateMetrics();}
  async function loadAnime(){const {data,error}=await client.from("anime").select("*").order("created_at",{ascending:false});if(error){notice("Could not load anime: "+error.message,true);return;}animeRows=data||[];renderAnime();fillAnimeSelect();}
  async function loadEpisodes(){const {data,error}=await client.from("episodes").select("*,anime(title)").order("anime_id").order("episode_number");if(error){notice("Could not load episodes: "+error.message,true);return;}episodeRows=data||[];renderEpisodes();}
  async function loadUsers(){try{const data=await invokeAdmin("list");profileRows=data.users||[];renderUsers();}catch(error){$("userTable").innerHTML='<p class="table-error">User list unavailable: '+escapeHtml(error.message)+'. Deploy the Supabase Edge Function from the repository first.</p>';}}
  function updateMetrics(){ $("metricAnime").textContent=animeRows.filter(x=>x.status==="published").length; $("metricEpisodes").textContent=episodeRows.filter(x=>x.is_published).length; $("metricUsers").textContent=profileRows.length; }
  function renderAnime(){const el=$("animeTable");if(!animeRows.length){el.innerHTML='<div class="table-empty">No titles yet. Add your first anime above.</div>';return;}el.innerHTML='<table><thead><tr><th>Title</th><th>Genre</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+animeRows.map(row=>'<tr><td><b>'+escapeHtml(row.title)+'</b><small>'+escapeHtml(row.release_year||"Year not set")+'</small></td><td>'+escapeHtml(row.genre)+'</td><td><span class="status-pill '+escapeHtml(row.status)+'">'+escapeHtml(row.status)+'</span></td><td class="row-actions"><button class="small-action" data-edit-anime="'+row.id+'">Edit</button><button class="small-action danger" data-delete-anime="'+row.id+'">Delete</button></td></tr>').join("")+'</tbody></table>'; }
  function fillAnimeSelect(){const select=$("episodeAnime"),old=select.value;select.innerHTML=animeRows.map(row=>'<option value="'+row.id+'">'+escapeHtml(row.title)+'</option>').join("");if(animeRows.some(row=>row.id===old))select.value=old;}
  function renderEpisodes(){const el=$("episodeTable");if(!episodeRows.length){el.innerHTML='<div class="table-empty">No episodes yet. Add an episode and an authorised video or download URL.</div>';return;}el.innerHTML='<table><thead><tr><th>Episode</th><th>Anime</th><th>Visibility</th><th>Sources</th><th>Actions</th></tr></thead><tbody>'+episodeRows.map(row=>'<tr><td><b>'+escapeHtml(row.episode_number+'. '+row.title)+'</b></td><td>'+escapeHtml(row.anime?.title||"Unknown title")+'</td><td><span class="status-pill '+(row.is_published?"published":"draft")+'">'+(row.is_published?"Published":"Draft")+'</span></td><td>'+((safeUrl(row.video_url)?"Video ":"")+(safeUrl(row.download_url)?"Download":"")||"None")+'</td><td class="row-actions"><button class="small-action" data-edit-episode="'+row.id+'">Edit</button><button class="small-action danger" data-delete-episode="'+row.id+'">Delete</button></td></tr>').join("")+'</tbody></table>'; }
  function renderUsers(){const el=$("userTable");if(!profileRows.length){el.innerHTML='<div class="table-empty">No user profiles found yet.</div>';return;}el.innerHTML='<table><thead><tr><th>Email</th><th>Role</th><th>Joined</th><th>Actions</th></tr></thead><tbody>'+profileRows.map(row=>'<tr><td><b>'+escapeHtml(row.email||"No email")+'</b></td><td><select class="inline-role" data-role-user="'+row.id+'" aria-label="Role for '+escapeHtml(row.email)+'"><option value="viewer" '+(row.role==="viewer"?"selected":"")+'>Viewer</option><option value="admin" '+(row.role==="admin"?"selected":"")+'>Admin</option></select></td><td>'+escapeHtml(row.created_at?new Date(row.created_at).toLocaleDateString():"—")+'</td><td class="row-actions">'+(row.id===currentUser?.id?'<span class="form-help">Current user</span>':'<button class="small-action danger" data-delete-user="'+row.id+'">Delete</button>')+'</td></tr>').join("")+'</tbody></table>'; }
  async function loadAnalytics(){
    const startDate=new Date(Date.now()-30*86400000).toISOString();
    const {data,error}=await client.from("watch_events").select("id,event_type,created_at,anime_id,anime(title)").gte("created_at",startDate).order("created_at",{ascending:false}).limit(500);
    if(error){$("analyticsTable").innerHTML='<p class="table-error">Analytics unavailable: '+escapeHtml(error.message)+'</p>';return;}
    const events=data||[],plays=events.filter(x=>x.event_type==="play"),views=events.filter(x=>x.event_type==="view"),downloads=events.filter(x=>x.event_type==="download");
    $("metricPlays").textContent=events.filter(x=>x.event_type==="play"&&Date.now()-new Date(x.created_at).getTime()<7*86400000).length;
    $("analyticsSummary").innerHTML=[["Views",views.length],["Plays",plays.length],["Downloads",downloads.length]].map(([label,value])=>'<div class="metric-card"><span>'+label+' · 30 days</span><b>'+value+'</b></div>').join("");
    const byTitle={};
    events.forEach(e=>{const name=e.anime?.title||"Unknown / deleted title";byTitle[name]=(byTitle[name]||0)+1;});
    const top=Object.entries(byTitle).sort((a,b)=>b[1]-a[1]).slice(0,6),maxTop=Math.max(1,...top.map(x=>x[1]));
    $("analyticsTop").innerHTML=top.length?top.map(([name,value])=>'<div class="analytics-bar-row"><div><span>'+escapeHtml(name)+'</span><b>'+value+'</b></div><div class="analytics-bar-track"><i style="width:'+Math.round(value/maxTop*100)+'%"></i></div></div>').join(""):'<p class="form-help">No title activity recorded yet.</p>';
    const days=[];
    for(let i=6;i>=0;i--){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-i);const key=d.toISOString().slice(0,10);days.push({key,label:d.toLocaleDateString(undefined,{weekday:"short"}),value:events.filter(e=>new Date(e.created_at).toISOString().slice(0,10)===key).length});}
    const maxDay=Math.max(1,...days.map(d=>d.value));
    $("analyticsTrend").innerHTML='<div class="trend-bars">'+days.map(d=>'<div class="trend-day"><div class="trend-bar-space"><i style="height:'+Math.max(d.value?5:2,Math.round(d.value/maxDay*100))+'%"></i></div><b>'+d.value+'</b><small>'+d.label+'</small></div>').join("")+'</div>';
    $("analyticsTable").innerHTML=events.length?'<table><thead><tr><th>Event</th><th>Anime</th><th>Time</th></tr></thead><tbody>'+events.map(e=>'<tr><td><span class="status-pill">'+escapeHtml(e.event_type)+'</span></td><td>'+escapeHtml(e.anime?.title||"Unknown / deleted title")+'</td><td>'+escapeHtml(new Date(e.created_at).toLocaleString())+'</td></tr>').join("")+'</tbody></table>':'<div class="table-empty">No recorded activity in the last 30 days.</div>';
  }
  function showTab(tab){document.querySelectorAll(".admin-tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));document.querySelectorAll(".admin-panel").forEach(p=>p.classList.toggle("hidden",p.id!=="panel-"+tab));}
  document.querySelectorAll(".admin-tab").forEach(button=>button.addEventListener("click",()=>showTab(button.dataset.tab)));
  function showForm(id,show=true){$(id).classList.toggle("hidden",!show);}
  function updateAnimePreview(){
    const title=$("animeTitle").value.trim(), genre=$("animeGenre").value.trim(), year=$("animeYear").value.trim();
    const synopsis=$("animeSynopsis").value.trim(), cover=safeUrl($("animeCover").value.trim()), status=$("animeStatus").value;
    $("animePreviewTitle").textContent=title||"Your anime title";
    $("animePreviewGenre").textContent=(genre||"GENRE").toUpperCase();
    $("animePreviewYear").textContent=year||"—";
    $("animePreviewSynopsis").textContent=synopsis||"Your synopsis will appear here.";
    $("animePreviewSymbol").textContent=(title||"N A").split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join("").toUpperCase()||"NA";
    $("animePreviewStatus").textContent=status.toUpperCase();
    $("animePreviewStatus").className="cover-status "+status;
    const image=$("animePreviewImage");
    image.hidden=!cover;
    $("animePreviewSymbol").hidden=!!cover;
    if(cover){image.onerror=()=>{image.hidden=true;$("animePreviewSymbol").hidden=false;};image.src=cover;}
    else{image.removeAttribute("src");image.onerror=null;}
  }
  function resetAnimeForm(){ $("animeForm").reset();$("animeId").value="";$("animeFormTitle").textContent="Add anime";updateAnimePreview(); }
  ["animeTitle","animeGenre","animeYear","animeCover","animeSynopsis","animeStatus"].forEach(id=>{ $(id).addEventListener("input",updateAnimePreview);$(id).addEventListener("change",updateAnimePreview); });
  $("newAnime").addEventListener("click",()=>{resetAnimeForm();showForm("animeForm");$("animeTitle").focus();});
  $("cancelAnime").addEventListener("click",()=>showForm("animeForm",false));
  $("animeTable").addEventListener("click",async event=>{const edit=event.target.closest("[data-edit-anime]"),del=event.target.closest("[data-delete-anime]");if(edit){const row=animeRows.find(x=>x.id===edit.dataset.editAnime);if(!row)return;$("animeId").value=row.id;$("animeTitle").value=row.title;$("animeGenre").value=row.genre;$("animeYear").value=row.release_year||"";$("animeCover").value=row.cover_url||"";$("animeSynopsis").value=row.synopsis||"";$("animeStatus").value=row.status;updateAnimePreview();$("animeFormTitle").textContent="Edit anime";showForm("animeForm");$("animeForm").scrollIntoView({behavior:"smooth",block:"start"});}if(del&&confirm("Delete this anime and its episodes? This cannot be undone.")){const {error}=await client.from("anime").delete().eq("id",del.dataset.deleteAnime);if(error)notice(error.message,true);else{notice("Anime deleted.");await refreshAll();}}});
  $("animeForm").addEventListener("submit",async event=>{event.preventDefault();const id=$("animeId").value;const payload={title:$("animeTitle").value.trim(),genre:$("animeGenre").value.trim(),release_year:$("animeYear").value?Number($("animeYear").value):null,cover_url:safeUrl($("animeCover").value)||null,synopsis:$("animeSynopsis").value.trim(),status:$("animeStatus").value,updated_at:new Date().toISOString()};const result=id?await client.from("anime").update(payload).eq("id",id):await client.from("anime").insert(payload);if(result.error){notice(result.error.message,true);return;}showForm("animeForm",false);resetAnimeForm();notice("Anime saved.");await refreshAll();});
  $("newEpisode").addEventListener("click",()=>{ $("episodeForm").reset();$("episodeId").value="";$("episodeNumber").value="1";$("episodeFormTitle").textContent="Add episode";fillAnimeSelect();showForm("episodeForm");$("episodeForm").scrollIntoView({behavior:"smooth",block:"start"});});
  $("cancelEpisode").addEventListener("click",()=>showForm("episodeForm",false));
  $("episodeTable").addEventListener("click",async event=>{const edit=event.target.closest("[data-edit-episode]"),del=event.target.closest("[data-delete-episode]");if(edit){const row=episodeRows.find(x=>x.id===edit.dataset.editEpisode);if(!row)return;$("episodeId").value=row.id;$("episodeAnime").value=row.anime_id;$("episodeNumber").value=row.episode_number;$("episodeTitle").value=row.title;$("episodeVideo").value=row.video_url||"";$("episodeDownload").value=row.download_url||"";$("episodePublished").value=String(row.is_published);$("episodeFormTitle").textContent="Edit episode";showForm("episodeForm");$("episodeForm").scrollIntoView({behavior:"smooth",block:"start"});}if(del&&confirm("Delete this episode?")){const {error}=await client.from("episodes").delete().eq("id",del.dataset.deleteEpisode);if(error)notice(error.message,true);else{notice("Episode deleted.");await refreshAll();}}});
  $("episodeForm").addEventListener("submit",async event=>{event.preventDefault();const id=$("episodeId").value;const video=$("episodeVideo").value.trim(),download=$("episodeDownload").value.trim();if(video&&!safeUrl(video)||download&&!safeUrl(download)){notice("Video and download links must be valid HTTP or HTTPS URLs.",true);return;}const payload={anime_id:$("episodeAnime").value,title:$("episodeTitle").value.trim(),episode_number:Number($("episodeNumber").value),video_url:video||null,download_url:download||null,is_published:$("episodePublished").value==="true"};const result=id?await client.from("episodes").update(payload).eq("id",id):await client.from("episodes").insert(payload);if(result.error){notice(result.error.message,true);return;}showForm("episodeForm",false);notice("Episode saved.");await refreshAll();});
  $("newUser").addEventListener("click",()=>showForm("userForm"));
  $("cancelUser").addEventListener("click",()=>showForm("userForm",false));
  $("userForm").addEventListener("submit",async event=>{event.preventDefault();const button=$("userForm").querySelector('button[type="submit"]');setBusy(button,true,"Creating…");try{await invokeAdmin("create",{email:$("userEmail").value.trim(),password:$("userPassword").value,role:$("userRole").value});showForm("userForm",false);$("userForm").reset();notice("Account created. If email confirmation is enabled, the user must verify their email.");await loadUsers();updateMetrics();}catch(error){notice(error.message,true);}finally{setBusy(button,false);}});
  $("userTable").addEventListener("change",async event=>{const select=event.target.closest("[data-role-user]");if(!select)return;try{await invokeAdmin("set-role",{userId:select.dataset.roleUser,role:select.value});notice("User role updated.");await loadUsers();}catch(error){notice(error.message,true);await loadUsers();}});
  $("userTable").addEventListener("click",async event=>{const button=event.target.closest("[data-delete-user]");if(!button||!confirm("Delete this account permanently?"))return;try{await invokeAdmin("delete",{userId:button.dataset.deleteUser});notice("User account deleted.");await loadUsers();updateMetrics();}catch(error){notice(error.message,true);}});
  $("refreshAnalytics").addEventListener("click",loadAnalytics);
  client.auth.getSession().then(({data})=>{if(data.session)checkAdmin(data.session.user);});
})();