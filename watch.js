(() => {
 const $=id=>document.getElementById(id), config=window.NITIN_SUPABASE, drm=window.NITIN_DRM_CONFIG||{};
 const ready=config&&config.url&&config.anonKey&&!config.url.includes("YOUR_PROJECT")&&!config.anonKey.includes("YOUR_PUBLIC")&&window.supabase;
 const client=ready?window.supabase.createClient(config.url,config.anonKey):null, id=new URLSearchParams(location.search).get("id");
 let player,storage,episode,session;
 function notice(text,error=false){$("watchNotice").textContent=text;$("watchNotice").classList.remove("hidden");$("watchNotice").style.borderColor=error?"#f87171":"#a78bfa66";}
 function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement("script");s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error("Could not load DRM player library. Connect to the internet and reload."));document.head.appendChild(s);});}
 function configured(){return /^https:\/\//i.test(drm.widevineLicenseServerUrl||"")&&!/YOUR_|example\.com/i.test(drm.widevineLicenseServerUrl||"")&&/^https:\/\//i.test(drm.licenseTokenEndpoint||"")&&!/YOUR_|example\.com/i.test(drm.licenseTokenEndpoint||"");}
 async function createPlayer(video){
  if(!window.shaka)await loadScript("https://cdn.jsdelivr.net/npm/shaka-player@4.15.19/dist/shaka-player.compiled.js");
  if(!shaka.Player.isBrowserSupported())throw new Error("This browser does not support the required encrypted-media features.");
  player=new shaka.Player();await player.attach(video);
  player.configure({drm:{servers:{"com.widevine.alpha":drm.widevineLicenseServerUrl},advanced:{"com.widevine.alpha":{distinctiveIdentifierRequired:false,persistentStateRequired:true}}},offline:{usePersistentLicense:true}});
  player.getNetworkingEngine().registerRequestFilter(async(type,request)=>{
   const requestUri=request.uris?.[0]||"";
   const telegramBase=(drm.telegramMediaEndpoint||"").replace(/\/+$/,"");
   if(type!==shaka.net.NetworkingEngine.RequestType.LICENSE){
    if(telegramBase&&requestUri.startsWith(telegramBase+"/")){
     if(!session?.access_token)throw new Error("Sign in is required for protected Telegram media.");
     request.headers.Authorization="Bearer "+session.access_token;
     request.headers.apikey=config.anonKey;
    }
    return;
   }
   if(!session?.access_token)throw new Error("Sign in is required for a protected license.");
   const response=await fetch(drm.licenseTokenEndpoint,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+session.access_token,"apikey":config.anonKey},body:JSON.stringify({episode_id:episode.id,asset_uri:episode.video_url})});
   if(!response.ok)throw new Error("DRM authorization denied ("+response.status+").");
   const result=await response.json();
   if(!result||!result.headers||typeof result.headers!=="object")throw new Error("DRM authorization endpoint must return a headers object.");
   for(const [name,value] of Object.entries(result.headers))if(/^[a-z0-9-]+$/i.test(name)&&typeof value==="string")request.headers[name]=value;
  });
  storage=new shaka.offline.Storage(player);storage.configure({offline:{usePersistentLicense:true},drm:{servers:{"com.widevine.alpha":drm.widevineLicenseServerUrl}}});
 }
 async function init(){
  if(!id||!client){$("watchTitle").textContent="Protected episode unavailable";notice("Configure Supabase and open a valid published episode ID.",true);return;}
  const {data:{session:current}}=await client.auth.getSession();session=current;
  const {data:row,error}=await client.from("episodes").select("id,title,episode_number,video_url,anime_id,anime(title,status)").eq("id",id).eq("is_published",true).maybeSingle();
  if(error||!row||row.anime?.status!=="published"){$("watchTitle").textContent="Episode unavailable";notice("Episode not found, not published, or blocked by Supabase policies.",true);return;}
  episode=row;$("watchTitle").textContent=row.anime.title+" — Episode "+row.episode_number+": "+row.title;$("watchSubtitle").textContent="Widevine-protected playback · NITIN ANIMES";
  $("backToAnime").href="anime.html?id="+encodeURIComponent(row.anime_id);$("backToAnime").textContent="← Back to "+row.anime.title;
  $("watchActions").innerHTML='<button class="primary-button" id="saveOffline" disabled>Save for offline</button><a class="secondary-button" href="offline-library.html">My offline videos</a><a class="secondary-button" href="anime.html?id='+encodeURIComponent(row.anime_id)+'">More episodes</a><a class="secondary-button" href="account.html">My account</a>';
  if(!session?.access_token){notice("Sign in before protected playback. Offline downloads require a provider that supports persistent Widevine licenses.");return;}
  if(!configured()){notice("DRM is not configured. Set a real Widevine license URL and server-side authorization endpoint in drm-config.js. Playback is blocked rather than falling back to unprotected video.",true);return;}
  const telegramBase=(drm.telegramMediaEndpoint||"").replace(/\/+$/,"");
  const isTelegramManifest=!!telegramBase&&row.video_url?.startsWith(telegramBase+"/");
  if(!row.video_url||!/^https:\/\//i.test(row.video_url)||!(isTelegramManifest||/\.(mpd|m3u8)(?:$|[?#])/i.test(row.video_url))){notice("Use an HTTPS DASH (.mpd) or DRM-packaged HLS (.m3u8) manifest. Direct MP4 is disabled.",true);return;}
  try{
   const video=$("episodeVideo");await createPlayer(video);await player.load(row.video_url);
   $("saveOffline").disabled=false;$("saveOffline").addEventListener("click",async()=>{
    const b=$("saveOffline");b.disabled=true;b.textContent="Preparing protected download…";
    try{await storage.store(row.video_url,{episodeId:row.id,title:row.title,episodeNumber:row.episode_number,animeTitle:row.anime.title,animeId:row.anime_id});b.textContent="Saved for offline";notice("Saved in this browser's protected storage, not as a standalone video file. Offline playback depends on persistent-license support and expiry.");await client.from("watch_events").insert({user_id:session.user.id,anime_id:row.anime_id,episode_id:row.id,event_type:"download"});}
    catch(e){b.disabled=false;b.textContent="Save for offline";notice("Offline save failed: "+(e.message||String(e))+". The provider must permit persistent licenses.",true);}
   });
   await client.from("watch_events").insert({user_id:session.user.id,anime_id:row.anime_id,episode_id:row.id,event_type:"play"});
   const {data:progress}=await client.from("watch_progress").select("position_seconds").eq("user_id",session.user.id).eq("episode_id",row.id).maybeSingle();
   if(progress?.position_seconds>5)video.addEventListener("loadedmetadata",()=>{try{video.currentTime=Math.min(progress.position_seconds,Math.max(0,video.duration-2));}catch{}},{once:true});
   let lastSave=0;video.addEventListener("timeupdate",async()=>{if(!Number.isFinite(video.duration)||video.duration<=0||video.currentTime<1)return;const now=Date.now();if(now-lastSave<10000&&video.currentTime<video.duration-5)return;lastSave=now;await client.from("watch_progress").upsert({user_id:session.user.id,episode_id:row.id,position_seconds:video.currentTime,duration_seconds:video.duration,updated_at:new Date().toISOString()},{onConflict:"user_id,episode_id"});});
  }catch(e){notice("Protected playback failed: "+(e.message||String(e))+". Check provider packaging, license URL, authorization endpoint, and Widevine support.",true);}
 }
 init();
})();