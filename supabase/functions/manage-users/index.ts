import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};
const json = (body: unknown, status=200) => new Response(JSON.stringify(body), {status,headers:corsHeaders});
function keyFromJson(name:string, preferred="default") {
  try { const parsed=JSON.parse(Deno.env.get(name)||"{}"); return parsed[preferred] || Object.values(parsed)[0] || ""; } catch { return ""; }
}
Deno.serve(async (req:Request) => {
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST") return json({error:"Method not allowed."},405);
  const url=Deno.env.get("SUPABASE_URL")||"";
  const anon=Deno.env.get("SUPABASE_ANON_KEY")||keyFromJson("SUPABASE_PUBLISHABLE_KEYS")||"";
  const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||keyFromJson("SUPABASE_SECRET_KEYS")||"";
  if(!url||!anon||!secret) return json({error:"Server configuration is incomplete. Set Supabase URL, public key and server-only secret key in Edge Function environment."},500);
  const authHeader=req.headers.get("Authorization")||"";
  if(!authHeader.startsWith("Bearer ")) return json({error:"Sign in as an admin first."},401);
  const token=authHeader.slice(7);
  const userClient=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:userResult,error:userError}=await userClient.auth.getUser(token);
  if(userError||!userResult.user) return json({error:"Your session is invalid or expired."},401);
  const adminClient=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:profile,error:profileError}=await adminClient.from("profiles").select("role").eq("id",userResult.user.id).maybeSingle();
  if(profileError||profile?.role!=="admin") return json({error:"Admin permission is required."},403);
  let body:any;
  try { body=await req.json(); } catch { return json({error:"Invalid JSON request."},400); }
  try {
    if(body.action==="list") {
      const {data,error}=await adminClient.auth.admin.listUsers({page:1,perPage:1000});
      if(error) throw error;
      const users=data.users||[];
      const {data:profiles, error:profilesError}=await adminClient.from("profiles").select("id,email,role,created_at").order("created_at",{ascending:false}).limit(1000);
      if(profilesError) throw profilesError;
      const profileMap=new Map((profiles||[]).map((p:any)=>[p.id,p]));
      return json({users:users.map((u:any)=>({id:u.id,email:u.email||profileMap.get(u.id)?.email||"",role:profileMap.get(u.id)?.role||"viewer",created_at:u.created_at,confirmed_at:u.email_confirmed_at||null}))});
    }
    if(body.action==="create") {
      const email=String(body.email||"").trim().toLowerCase();
      const password=String(body.password||"");
      const role=body.role==="admin"?"admin":"viewer";
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({error:"Enter a valid email address."},400);
      if(password.length<10) return json({error:"Use a password with at least 10 characters."},400);
      const {data,error}=await adminClient.auth.admin.createUser({email,password,email_confirm:false});
      if(error) throw error;
      if(data.user) {
        const {error:roleError}=await adminClient.from("profiles").upsert({id:data.user.id,email,role},{onConflict:"id"});
        if(roleError) {
          await adminClient.auth.admin.deleteUser(data.user.id);
          throw roleError;
        }
      }
      return json({ok:true,user:{id:data.user?.id,email,role}});
    }
    if(body.action==="set-role") {
      const userId=String(body.userId||"");
      const role=body.role==="admin"?"admin":"viewer";
      if(!userId) return json({error:"Missing user ID."},400);
      if(userId===userResult.user.id) return json({error:"For safety, you cannot change your own admin role here."},400);
      const {error}=await adminClient.from("profiles").update({role}).eq("id",userId);
      if(error) throw error;
      return json({ok:true});
    }
    if(body.action==="delete") {
      const userId=String(body.userId||"");
      if(!userId) return json({error:"Missing user ID."},400);
      if(userId===userResult.user.id) return json({error:"You cannot delete your own signed-in account."},400);
      const {error}=await adminClient.auth.admin.deleteUser(userId);
      if(error) throw error;
      return json({ok:true});
    }
    return json({error:"Unknown action."},400);
  } catch(error) {
    console.error("manage-users failed:",error);
    return json({error:error instanceof Error?error.message:"Unexpected server error."},500);
  }
});