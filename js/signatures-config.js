// הגדרות חיבור ל-Supabase לדשבורד "חוסרי חתימה לפי יום".
// שורות הדוח מכילות שמות לקוחות, ולכן כמעט הכל דורש התחברות. מפתח ה-anon
// נותן גישה רק לאגרגטים החודשיים ולסטטיסטיקת השמות — בלי PII.
window.SIGNATURES_CONFIG = {
  SUPABASE_URL: "https://spbjxrobslgbvygohdxj.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_2CME5bGc-Fy8Opog3Z3xRw_fBKh-z2y",

  // כרטיס הלקוחה ברפיד. האפליקציה עובדת ב-html5Mode עם <base href="/">,
  // ולכן הנתיב הוא /patients/<cardCode> בלי #. שם הלקוחה בדוח הופך לקישור
  // לכתובת הזו, כדי שאפשר יהיה לוודא בעין שהטפסים באמת קיימים.
  RAPID_BASE_URL: "https://betterskin.rapid-image.net",
  RAPID_CARD_PATH: "/patients/",
};
