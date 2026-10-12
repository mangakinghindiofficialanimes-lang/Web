(() => {
  const $=id=>document.getElementById(id);
  const safeUrl=value=>{try{const u=new URL(value);return ["https:","http:"].includes(u.protocol)?u.href:"";}catch{return "";}};
  const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const sample={
    "sample-skybound":{title:"Skybound Legends",genre:"Adventure",release_year:2026,synopsis:"A young explorer follows a trail of floating islands and discovers that every legend has a beginning.",color:"linear-gradient(135deg,#30235d,#6c4d9f 50%,#ed9fce)"},
    "sample-neon":{title:"Neon Ronin",genre:"Action",release_year:2025,synopsis:"In a city that never sleeps, a quiet swordsman searches for the truth behind a mysterious signal.",color:"linear-gradient(135deg,#112c49,#126f83 55%,#ab7de3)"},
    "sample-moonlit":{title:"Moonlit Academy",genre:"Fantasy",release_year:2026,synopsis:"An unexpected invitation brings a new student to a school where the stars seem a little too close.",color:"linear-gradient(135deg,#382051,#8758a8 52%,#f1b5c9)"},
    "sample-wild":{title:"Wild Horizon",genre:"Adventure",release_year:2024,synopsis:"A crew of friends sets out across a vast frontier, chasing a map that no one believes is real.",color:"linear-gradient(135deg,#183f3a,#398c75 52%,#d7c881)"},
    "sample-echo":{title:"Echoes of Tomorrow",genre:"Drama",release_year:2025,synopsis:"A thoughtful story about friendship, choices, and the small moments that shape the future.",color:"linear-gradient(135deg,#29284e,#6a74a7 55%,#d5b3e5)"},
    "sample-ember":{title:"Ember Knights",genre:"Action",release_year:2026,synopsis:"A new generation of guardians learns that courage means more than winning a battle.",color:"linear-gradient(135deg,#51252e,#b9584c 55%,#efbd8d)"}
  };
  const config=window.NITIN_SUPABASE;
  const configured=config&&config.url&&config.anonKey&&!config.url.includes("YOUR_PROJECT")&&!config.anonKey.includes("YOUR_PUBLIC")&&window.supabase;
  const client=configured?window.supabase.createClient(config.url,config.anonKey):null;
  const id=new URLSearchParams(location.search).get("id");
  let anime=null;
  function renderHeader(item){
    const cover=safeUrl(item.cover_url);
    $("detailHero").innerHTML='<div class="detail-cover" style="--cover:'+(item.color||"linear-gradient(135deg,#30235d,#6c4d9f 50%,#ed9fce)")+'">'+(cover?'<img src="'+esc(cover)+'" alt="">':'<span>'+esc((item.title||"NA").split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase())+'</span>')+'</div><div class="detail-copy"><div class="eyebrow">'+esc((item.genre||"ANIME").toUpperCase())+' · '+esc(item.release_year||"YEAR NOT SET")+'</div><h1>'+esc(item.title)+'</h1><p>'+esc(item.synopsis||"More information coming soon.")+'</p><div class="detail-tags"><span>'+esc(item.status==="published"?"Published":"Sample title")+'</span><span>NITIN ANIMES</span></div></div>';
    document.title=item.title+" — NITIN ANIMES";
  }
  async function record(eventType,episodeId=null){
    if(!client||!anime||anime.demo)return;
    const {data:{user}}=await client.auth.getUser();
    await client.from("watch_events").insert({user_id:user?.id||null,anime_id:anime.id,episode_id:episodeId,event_type:eventType});
  }
  function renderEpisodes(rows){
    const el=$("detailEpisodeList");
    if(!rows.length){el.innerHTML='<p class="source-note">No published episodes are available yet.</p>';return;}
    el.innerHTML=rows.map(ep=>{
      const video=safeUrl(ep.video_url),download=safeUrl(ep.download_url);
      return '<article class="detail-episode"><div class="episode-index">'+String(ep.episode_number).padStart(2,"0")+'</div><div class="detail-episode-name"><b>'+esc(ep.title)+'</b><small>Episode '+esc(ep.episode_number)+'</small></div><div class="detail-episode-actions">'+(video?'<button class="primary-button" data-play="'+esc(video)+'" data-episode="'+esc(ep.id)+'">▶ Play here</button><a class="secondary-button" href="watch.html?id='+encodeURIComponent(ep.id)+'">Episode page ↗</a>':'<span class="no-source">No stream yet</span>')+(download?'<a class="secondary-button" data-download="'+esc(ep.id)+'" href="'+esc(download)+'" target="_blank" rel="noopener noreferrer">Download ↗</a>':'')+'</div><div class="detail-player hidden" id="player-'+esc(ep.id)+'"></div></article>';
    }).join("");
    el.querySelectorAll("[data-play]").forEach(button=>button.addEventListener("click",async()=>{
      const player=$("player-"+button.dataset.episode);
      document.querySelectorAll(".detail-player").forEach(p=>{if(p!==player){p.classList.add("hidden");p.innerHTML="";}});
      player.classList.remove("hidden");
      player.innerHTML='<video controls autoplay playsinline preload="metadata" src="'+esc(button.dataset.play)+'">Your browser does not support HTML video.</video>';
      await record("play",button.dataset.episode);
      player.scrollIntoView({behavior:"smooth",block:"nearest"});
    }));
    el.querySelectorAll("[data-download]").forEach(link=>link.addEventListener("click",()=>record("download",link.dataset.download)));
  }
  async function init(){
    if(!id){$("detailHero").innerHTML='<div class="table-empty">No anime was selected. Return to the library and choose a title.</div>';$("detailEpisodeList").innerHTML="";return;}
    if(id.startsWith("sample-")||!client){
      anime=sample[id];
      if(!anime){$("detailHero").innerHTML='<div class="table-empty">This title is unavailable.</div>';$("detailEpisodeList").innerHTML="";return;}
      anime.demo=true;renderHeader(anime);$("detailEpisodeList").innerHTML='<p class="source-note">This is a catalogue sample. No episode videos or download links are included. Connect Supabase and add authorised episodes through the admin portal.</p>';return;
    }
    const {data,error}=await client.from("anime").select("*").eq("id",id).eq("status","published").maybeSingle();
    if(error||!data){$("detailHero").innerHTML='<div class="table-empty">This title is unavailable or could not be loaded. Check the Supabase configuration and published catalogue.</div>';$("detailEpisodeList").innerHTML="";return;}
    anime=data;renderHeader(anime);await record("view");
    const {data:episodes,error:episodeError}=await client.from("episodes").select("id,title,episode_number,video_url,download_url").eq("anime_id",id).eq("is_published",true).order("episode_number");
    if(episodeError){$("detailEpisodeList").innerHTML='<p class="source-note">Episodes could not be loaded right now.</p>';return;}
    renderEpisodes(episodes||[]);
  }
  init();
})();