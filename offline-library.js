(() => {
 const $=id=>document.getElementById(id),drm=window.NITIN_DRM_CONFIG||{};let player,storage;
 function message(text,error=false){$("offlineMessage").textContent=text;$("offlineMessage").style.color=error?"#f87171":"#c7b8ff";}
 async function loadScript(src){await new Promise((resolve,reject)=>{const s=document.createElement("script");s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error("Player library is not cached. Open this page online once, then retry."));document.head.appendChild(s);});}
 async function init(){
  if(!/^https:\/\//i.test(drm.widevineLicenseServerUrl||"")||/YOUR_|example\.com/i.test(drm.widevineLicenseServerUrl||"")){message("Configure a real Widevine license server first.",true);return;}
  try{
   if(!window.shaka)await loadScript("https://cdn.jsdelivr.net/npm/shaka-player@4.15.19/dist/shaka-player.compiled.js");
   if(!shaka.Player.isBrowserSupported())throw new Error("This browser does not support encrypted-media features.");
   player=new shaka.Player();await player.attach($("offlineVideo"));player.configure({drm:{servers:{"com.widevine.alpha":drm.widevineLicenseServerUrl},advanced:{"com.widevine.alpha":{persistentStateRequired:true}}},offline:{usePersistentLicense:true}});
   storage=new shaka.offline.Storage(player);const items=await storage.list();
   if(!items.length){$("offlineList").innerHTML='<p class="section-subtitle">No protected episodes saved in this browser yet.</p>';return;}
   $("offlineList").innerHTML=items.map((item,i)=>'<div style="display:flex;gap:12px;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--line)"><div><b>'+String(item.appMetadata?.animeTitle||"Saved episode").replace(/[&<>"]/g,"")+'</b><p style="margin:4px 0;font-size:12px;color:var(--muted)">'+String(item.appMetadata?.title||"Protected episode").replace(/[&<>"]/g,"")+'</p></div><div style="display:flex;gap:8px"><button class="primary-button" data-play="'+i+'">Play</button><button class="secondary-button" data-delete="'+i+'">Delete</button></div></div>').join("");
   $("offlineList").querySelectorAll("[data-play]").forEach(b=>b.addEventListener("click",async()=>{try{await player.load(items[Number(b.dataset.play)].offlineUri);message("Playing saved content in the NITIN ANIMES player.");}catch(e){message("Offline license unavailable or expired: "+e.message,true);}}));
   $("offlineList").querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",async()=>{b.disabled=true;try{await storage.remove(items[Number(b.dataset.delete)].offlineUri);message("Saved episode deleted.");await renderAgain();}catch(e){b.disabled=false;message("Delete failed: "+e.message,true);}}));
  }catch(e){message("Offline library failed: "+e.message,true);}
 }
 async function renderAgain(){await storage.destroy();await player.destroy();$("offlineList").innerHTML="";await init();}init();
})();