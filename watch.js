(() => {
 const $=id=>document.getElementById(id);
 const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const safeUrl=value=>{try{const u=new URL(value);return ["https:","http:"].includes(u.protocol)?u.href:"";}catch{return "";}};
 const config=window.NITIN_SUPABASE;
 const ready=config&&config.url&&config.anonKey&&!config.url.includes("YOUR_PROJECT")&&!config.anonKey.includes("YOUR_PUBLIC")&&window.supabase;
 const client=ready?window.supabase.createClient(config.url,config.anonKey):null;
 const id=new URLSearchParams(location.search).get("id");
 function notice(text){$("watchNotice").textContent=text;$("watchNotice").classList.remove("hidden");}
 async function init(){
  if(!id||!client){$("watchTitle").textContent="Episode unavailable";$("watchSubtitle").textContent="Connect Supabase and open an episode from the library.";notice("This page needs a configured Supabase project and a valid published episode ID.");return;}
  const {data:episode,error}=await client.from("episodes").select("id,title,episode_number,video_url,download_url,anime_id,anime(title,status)").eq("id",id).eq("is_published",true).maybeSingle();
  if(error||!episode||episode.anime?.status!=="published"){$("watchTitle").textContent="Episode unavailable";$("watchSubtitle").textContent="This episode is not published or could not be loaded.";notice("Check the episode ID, publish status, and Supabase Row Level Security settings.");return;}
  const video=safeUrl(episode.video_url),download=safeUrl(episode.download_url);
  $("watchTitle").textContent=episode.anime.title+" — Episode "+episode.episode_number+": "+episode.title;
  $("watchSubtitle").textContent="Authorised video source · NITIN ANIMES";
  $("backToAnime").href="anime.html?id="+encodeURIComponent(episode.anime_id);
  $("backToAnime").textContent="← Back to "+episode.anime.title;
  let playbackUser=null;
  const {data:{user}}=await client.auth.getUser(); playbackUser=user||null;
  if(!video){$("watchPlayer").innerHTML='<div class="player-placeholder">No video source configured</div>';notice("The episode is published, but its video URL is missing or invalid.");}
  else{
   $("watchPlayer").innerHTML='<video id="episodeVideo" controls playsinline preload="metadata" src="'+esc(video)+'">Your browser does not support HTML video.</video>';
   await client.from("watch_events").insert({user_id:playbackUser?.id||null,anime_id:episode.anime_id,episode_id:episode.id,event_type:"play"});
   const player=$("episodeVideo");
   if(playbackUser){
    const {data:progress}=await client.from("watch_progress").select("position_seconds").eq("user_id",playbackUser.id).eq("episode_id",episode.id).maybeSingle();
    if(progress?.position_seconds>5){player.addEventListener("loadedmetadata",()=>{try{player.currentTime=Math.min(progress.position_seconds,Math.max(0,player.duration-2));}catch{}},{once:true});}
    let lastSave=0;
    player.addEventListener("timeupdate",async()=>{if(!Number.isFinite(player.duration)||player.duration<=0||player.currentTime<1)return;const now=Date.now();if(now-lastSave<10000&&player.currentTime<player.duration-5)return;lastSave=now;await client.from("watch_progress").upsert({user_id:playbackUser.id,episode_id:episode.id,position_seconds:player.currentTime,duration_seconds:player.duration,updated_at:new Date().toISOString()},{onConflict:"user_id,episode_id"});});
    player.addEventListener("ended",async()=>{await client.from("watch_progress").upsert({user_id:playbackUser.id,episode_id:episode.id,position_seconds:player.duration,duration_seconds:player.duration,updated_at:new Date().toISOString()},{onConflict:"user_id,episode_id"});});
   }
  }
  $("watchActions").innerHTML=(download?'<a class="primary-button" id="downloadLink" href="'+esc(download)+'" target="_blank" rel="noopener noreferrer">Download episode ↗</a>':'')+'<a class="secondary-button" href="anime.html?id='+encodeURIComponent(episode.anime_id)+'">More episodes</a><a class="secondary-button" href="account.html">My account / progress</a>';
  const downloadLink=$("downloadLink");
  if(downloadLink)downloadLink.addEventListener("click",async()=>{await client.from("watch_events").insert({user_id:playbackUser?.id||null,anime_id:episode.anime_id,episode_id:episode.id,event_type:"download"});});
 }
 init();
})();