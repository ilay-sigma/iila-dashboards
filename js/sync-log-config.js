// הגדרות חיבור ל-Supabase לדף "לוג עדכונים".
// בניגוד לשאר הדוחות, כאן אין שום דבר שנגיש בלי התחברות: התצוגות
// public.sync_* מסוננות ב-DB ל-app.eff_role()='manager', והדף עצמו רשום
// ב-app.page_roles למנהל בלבד. הודעות שגיאה הן מידע תפעולי, לא מספר מצטבר.
window.SYNCLOG_CONFIG = {
  SUPABASE_URL: "https://spbjxrobslgbvygohdxj.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_2CME5bGc-Fy8Opog3Z3xRw_fBKh-z2y",
};
