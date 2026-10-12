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
  const {data:episode,error}=await client.from("episodes").select("id,title,episode_number,video_url,anime_id,anime(title,status)").eq("id",id).eq("is_published",true).maybeSingle();
  if(error||!episode||episode.anime?.status!=="published"){$("watchTitle").textContent="Episode unavailable";$("watchSubtitle").textContent="This episode is not published or could not be loaded.";notice("Check the episode ID, publish status, and Supabase Row Level Security settings.");return;}
  const video=safeUrl(episode.video_url);
  $("watchTitle").textContent=episode.anime.title+" — Episode "+episode.episode_number+": "+episode.title;
  $("watchSubtitle").textContent="NITIN ANIMES player · MP4 and compatible HLS streams";
  $("backToAnime").href="anime.html?id="+encodeURIComponent(episode.anime_id);
  $("backToAnime").textContent="← Back to "+episode.anime.title;
  const {data:{user}}=await client.auth.getUser(); const playbackUser=user||null;
  if(!video){$("watchPlayer").innerHTML='<div class="player-placeholder">No video source configured</div>';notice("The episode is published, but its video URL is missing or invalid.");}
  else{
   $("watchPlayer").innerHTML='<video id="episodeVideo" controls controlsList="nodownload" disablePictureInPicture playsinline preload="metadata">Your browser does not support HTML video.</video>';
   await client.from("watch_events").insert({user_id:playbackUser?.id||null,anime_id:episode.anime_id,episode_id:episode.id,event_type:"play"});
   const player=$("episodeVideo");
   player.addEventListener("contextmenu",event=>event.preventDefault());
   if(/\.m3u8(?:$|[?#])/i.test(video)){
    if(player.canPlayType("application/vnd.apple.mpegurl")) player.src=video;
    else {
     const loader=document.createElement("script");
     loader.src="https://cdn.jsdelivr.net/npm/hls.js@1.5.18/dist/hls.min.js";
     loader.onload=()=>{
      if(window.Hls&&window.Hls.isSupported()){
       const hls=new window.Hls({enableWorker:true,lowLatencyMode:false});
       hls.loadSource(video);hls.attachMedia(player);
       hls.on(window.Hls.Events.ERROR,(_event,data)=>{if(data.fatal)notice("The HLS stream failed. Check the stream URL, CORS settings, and any encryption/license requirements.");});
      }else notice("This browser cannot play this HLS stream. Try an updated browser.");
     };
     loader.onerror=()=>notice("Could not load HLS playback support. Check your internet connection.");
     document.head.appendChild(loader);
    }
   }else player.src=video;
   if(playbackUser){
    const {data:progress}=await client.from("watch_progress").select("position_seconds").eq("user_id",playbackUser.id).eq("episode_id",episode.id).maybeSingle();
    if(progress?.position_seconds>5){player.addEventListener("loadedmetadata",()=>{try{player.currentTime=Math.min(progress.position_seconds,Math.max(0,player.duration-2));}catch{}},{once:true});}
    let lastSave=0;
    player.addEventListener("timeupdate",async()=>{if(!Number.isFinite(player.duration)||player.duration<=0||player.currentTime<1)return;const now=Date.now();if(now-lastSave<10000&&player.currentTime<player.duration-5)return;lastSave=now;await client.from("watch_progress").upsert({user_id:playbackUser.id,episode_id:episode.id,position_seconds:player.currentTime,duration_seconds:player.duration,updated_at:new Date().toISOString()},{onConflict:"user_id,episode_id"});});
    player.addEventListener("ended",async()=>{await client.from("watch_progress").upsert({user_id:playbackUser.id,episode_id:episode.id,position_seconds:player.duration,duration_seconds:player.duration,updated_at:new Date().toISOString()},{onConflict:"user_id,episode_id"});});
   }
  }
  $("watchActions").innerHTML='<a class="secondary-button" href="anime.html?id='+encodeURIComponent(episode.anime_id)+'">More episodes</a><a class="secondary-button" href="account.html">My account / progress</a>';
  notice("Direct file downloads are disabled in this player preview. Player-only offline downloads require a DRM license service and a protected download app. Hiding a download link alone cannot prevent copying.");
 }
 init();
})();