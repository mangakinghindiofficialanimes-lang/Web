// Public endpoint URLs only. Never put secrets or signing keys in browser code.
window.NITIN_DRM_CONFIG = {
  widevineLicenseServerUrl: "https://YOUR_DRM_PROVIDER_WIDEVINE_LICENSE_URL",
  licenseTokenEndpoint: "https://YOUR_PROJECT_ID.supabase.co/functions/v1/drm-license-auth",
  // Public endpoint URL only; Telegram bot credentials stay server-side.
  telegramMediaEndpoint: "https://YOUR_PROJECT_ID.supabase.co/functions/v1/telegram-media"
};