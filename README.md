# DASHBOARDS

שמונה דשבורדים ודף לוג, מאחורי כניסה אחת עם Google. כל התיעוד עבר לתיקיית **`..\docs\`**.

```
py serve.py 8080
```
→ http://localhost:8080/login.html

| קובץ | דוח | תיעוד |
|---|---|---|
| `login.html` | כניסה וניתוב לפי תפקיד | `docs/README-auth.md` |
| `users.html` | ניהול משתמשים (סופר אדמין בלבד) | `docs/README-auth.md` |
| `index.html` | KPI — הכנסות | `docs/README-kpi.md` |
| `front-consultants.html` | ייעוצים פרונטליים (כולל השלמות מחודש שעבר) | `docs/README-front-consultants.md` |
| `phone-reps.html` | מתאמות פגישות (3 צוותים, תחרויות) | `docs/README-phone-reps.md` |
| `signatures.html` | חוסרי חתימה (אישורים, חוסרים לפי יועצות) | `docs/README-signatures.md` |
| `completions.html` | השלמות מחודש קודם | `docs/README-completions.md` |
| `payments.html` | אמצעי תשלום ו-ERN | `docs/README-payments.md` |
| `center.html` | ריכוז מרכז (מטפלות, מנהלות משרד, מת"ל) | `docs/README-kpi.md` |
| `sync-log.html` | לוג עדכונים (מנהל בלבד) | `..\אוטומציה\README.md` |

**התחלה כאן:** `docs/מדריך למשתמש.md`

## מבנה
- `assets/` — `design-system.css` (v3, 21/09/2026), הלוגו, ו-`vendor/open-props.min.css` (טוקני עיצוב — נטען לפני design-system). כל הדפים טוענים אותם; אין CSS מקומי. `style-preview.html` = דף בדיקה ויזואלי בלי נתונים.
- `js/` — קובץ config לכל דוח (כתובת Supabase + מפתח anon), `ui.js` (ספריית הרכיבים: פורמטים, גרפים RTL, מודאלים, סימני "?") ו-`explain.js` (הסברי החישובים לכל "?").
- `js/auth-config.js` + `js/auth.js` + `js/nav.js` — התחברות, ניתוב לפי תפקיד,
  והבאנר העליון. נטענים בכל דף דוח לפני ה-config שלו.

`client_secret_*.json` הוא סוד של Google OAuth ואינו חלק מהדשבורדים.

## פרסום

שני יעדים, ושניהם מאותם קבצים:

| יעד | סקריפט | כתובת | למי |
|---|---|---|---|
| רשת המשרד | `שרת מקומי/scripts/publish.ps1` | `https://192.168.3.166/login.html` | מי שנמצא במשרד |
| אינטרנט | `שרת מקומי/scripts/deploy-vercel.ps1` | `https://iila-dashboards.vercel.app` | גם מחוץ למשרד |

הפרסום ל-Vercel דורש פעם אחת `VERCEL_TOKEN` (ראו את ההערות בראש הסקריפט) ועדכון
של Redirect URLs ב-Supabase, אחרת התחברות Google תיכשל בכתובת החדשה. הדפים הם
קבצים סטטיים והסינון לפי תפקיד נשאר ב-DB, ולכן חשיפת האתר לאינטרנט אינה מרחיבה
את מה שמשתמש רואה. `/intake/`, `/fireberry/` ו-`/appointments/` נשארים מקומיים.
