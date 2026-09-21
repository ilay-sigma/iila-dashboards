// הגדרות חיבור ל-Supabase לדשבורד "יועצות פרונטליות".
// מפתח ה-anon ציבורי בכוונה — הוא נותן גישה לתצוגות אגרגט בלבד (ללא שמות/טלפונים
// של לקוחות). מסך ההזנה הידנית דורש התחברות (Supabase Auth) ופועל בהרשאת המשתמש.
window.FRONT_CONFIG = {
  SUPABASE_URL: "https://spbjxrobslgbvygohdxj.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_2CME5bGc-Fy8Opog3Z3xRw_fBKh-z2y",
  // סטנדרט ממוצע שולם-לפגישה בלוח היומי (העמודות AH/AI בגיליון 'סיכום מפורט - פרונט')
  DAILY_STANDARD_LOW: 4000,
  DAILY_STANDARD_HIGH: 6000,
};
