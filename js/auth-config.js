// הגדרות ההתחברות המשותפות לכל הדשבורדים.
// המפתח הפומבי כאן הוא אותו מפתח שכבר נמצא בשאר קבצי ה-config — הוא מאפשר
// קריאה בלבד למה ש-anon מורשה לקרוא, ואינו נותן גישה לטבלאות ההרשאות.
window.AUTH_CONFIG = {
  SUPABASE_URL:      "https://spbjxrobslgbvygohdxj.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_2CME5bGc-Fy8Opog3Z3xRw_fBKh-z2y",
  ALLOWED_DOMAIN:    "iilaberlin.co.il",   // רק חשבונות Workspace של העסק
  LOGIN_PAGE:        "login.html",
  NOT_FOUND_PAGE:    "404.html",
};
