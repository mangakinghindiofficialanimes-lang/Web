(() => {
  const form = document.getElementById("loginForm");
  const message = document.getElementById("authMessage");
  const warning = document.getElementById("configWarning");
  const dashboard = document.getElementById("adminDashboard");
  const signOutButton = document.getElementById("signOutButton");
  const configured = window.NITIN_SUPABASE && window.NITIN_SUPABASE.url && window.NITIN_SUPABASE.anonKey &&
    !window.NITIN_SUPABASE.url.includes("YOUR_PROJECT") && !window.NITIN_SUPABASE.anonKey.includes("YOUR_PUBLIC");
  let client = null;
  if (!configured || !window.supabase) {
    form.querySelector("button").disabled = true;
    message.textContent = "Supabase is not configured yet.";
    return;
  }
  warning.classList.add("hidden");
  client = window.supabase.createClient(window.NITIN_SUPABASE.url, window.NITIN_SUPABASE.anonKey);
  async function checkAdmin(user) {
    const { data, error } = await client.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (error || !data || data.role !== "admin") {
      dashboard.classList.add("hidden");
      form.classList.remove("hidden");
      message.textContent = "This account is not authorised as an admin. Ask the project owner to grant the admin role in Supabase.";
      await client.auth.signOut();
      return;
    }
    form.classList.add("hidden");
    dashboard.classList.remove("hidden");
    document.getElementById("adminIdentity").textContent = "Signed in as " + user.email + ".";
    message.textContent = "";
  }
  form.addEventListener("submit", async event => {
    event.preventDefault();
    message.textContent = "Signing in…";
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) { message.textContent = error.message; return; }
    await checkAdmin(data.user);
  });
  signOutButton.addEventListener("click", async () => {
    await client.auth.signOut();
    dashboard.classList.add("hidden");
    form.classList.remove("hidden");
    form.reset();
    message.textContent = "You have been signed out.";
  });
  client.auth.getSession().then(({data}) => {
    if (data.session) checkAdmin(data.session.user);
  });
})();