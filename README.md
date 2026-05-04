# HydroLock

> Your phone stays locked. Until you drink.

HydroLock is a minimal hydration-enforced app locker built as a progressive web app. It locks access to a full-screen overlay on a set interval and only unlocks when you log your water intake — forcing you to build a daily hydration habit through friction.

---

## Features

- **Hydration Gate** — the app locks on a timer you set; the only way out is to drink water and log it
- **Daily Goal Tracking** — set a custom daily water intake goal with a recommended amount calculated from your body weight
- **Personalized Experience** — enter your name for personalized lock screen messages
- **Streak Tracking** — tracks consecutive days you hit your goal to keep momentum
- **Session Log** — every drink you log is timestamped and displayed in a daily feed
- **Goal Completion Screen** — a satisfying full-screen moment when you hit your daily goal
- **7-Day History Chart** — visual bar chart of your intake over the past week
- **Web Notifications** — get reminded when your lock interval ends, even if the tab is in the background
- **Unit Toggle** — switch between ml and oz
- **Zero Backend** — everything runs in the browser using localStorage, no account or server needed

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React + Vite |
| Styling | Tailwind CSS |
| State | React `useState` + `useRef` |
| Persistence | localStorage |
| Notifications | Web Notifications API |
| Font | Inter (Google Fonts) |
| Deployment | Any static host (Vercel, Netlify, GitHub Pages) |

No external component libraries. No backend. No database.

---

## App Screens

### 1. Onboarding
First-launch screen introducing the concept. Shows once and sets `hydrolock_onboarded` in localStorage.

### 2. Setup
Collects user name, weight (for goal recommendation), unit preference (ml/oz), daily goal, lock interval, and notification preference.

### 3. Notification Permission
A dedicated screen explaining why notifications are needed before triggering the browser permission prompt.

### 4. Lock Screen
The core screen. Shows a personalized message, rotating hydration fact, today's progress, and a +/− water input. The app cannot be exited from this screen without logging water.

### 5. Home / Unlocked Screen
Shows the countdown to next lock, today's intake progress, streak count, hydration status label, an extra log button, and a timestamped session feed.

### 6. Goal Completion Screen
Full-screen celebration triggered once per day when the daily goal is first reached. Auto-dismisses after 4 seconds.

### 7. Stats / History Screen
7-day intake bar chart, weekly summary stats (best day, current streak, weekly average), and a full chronological history list.

### 8. Settings
Edit daily goal, lock interval. Reset today's progress. Accessible from the home screen gear icon.

---

## Screen State Machine

```
"onboarding" → "setup" → "notification_permission" → "locked"
                                                          ↕
                                                      "unlocked" ⇄ "goal_complete"
                                                          ↕
                                                       "stats"
                                                          ↕
                                                      "settings"
```

---

## localStorage Schema

| Key | Type | Description |
|---|---|---|
| `hydrolock_onboarded` | boolean | Whether the user has completed onboarding |
| `hydrolock_user_name` | string | User's first name for personalization |
| `hydrolock_unit` | `"ml"` \| `"oz"` | Preferred unit of measurement |
| `hydrolock_weight_kg` | number | Used to compute recommended goal |
| `hydrolock_daily_goal_ml` | number | Daily intake target in ml |
| `hydrolock_interval_minutes` | number | Lock interval in minutes |
| `hydrolock_today_date` | string | `"YYYY-MM-DD"` — used to detect day rollover |
| `hydrolock_today_intake_ml` | number | Total intake logged today in ml |
| `hydrolock_today_log_entries` | JSON array | `[{ time: "09:14", amount: 250 }]` |
| `hydrolock_timer_end_timestamp` | number | `Date.now()` ms — when the current unlock expires |
| `hydrolock_streak` | number | Consecutive days the daily goal was met |
| `hydrolock_last_goal_met_date` | string | `"YYYY-MM-DD"` of last goal completion |
| `hydrolock_history` | JSON object | `{ "2026-04-30": 2000 }` — daily totals |
| `hydrolock_goal_complete_shown_today` | boolean | Prevents goal screen showing more than once a day |
| `hydrolock_notification_permission_asked` | boolean | Whether the permission prompt has been shown |

---

## How the Lock Works

1. User completes setup and the first lock screen appears immediately
2. User logs water intake (default 250ml, adjustable with +/−) and taps "I drank it — Unlock"
3. The app records the intake, timestamps the session, and starts a countdown timer
4. When the timer hits `00:00`, the lock screen returns — unavoidable
5. A web notification fires simultaneously if permission was granted
6. This cycle repeats until the daily goal is met, after which unlocking requires no intake log

---

## Streak Logic

On every app load, the current date is compared to `hydrolock_today_date`:

- If a new day is detected, the app checks whether yesterday's total in `hydrolock_history` met the daily goal
- If yes → streak increments by 1
- If no → streak resets to 0
- Today's intake, log entries, and goal completion flag are all reset

---

## Hydration Status Labels

Displayed on the Home Screen based on percentage of daily goal reached:

| Progress | Label |
|---|---|
| 0 – 30% | ⚠ Critically low |
| 31 – 60% | ↓ Falling behind |
| 61 – 90% | → On track |
| 91 – 100%+ | ✓ Well hydrated |

---

## Design System

HydroLock uses a strict black and white design language inspired by Uber's minimal aesthetic.

| Token | Value |
|---|---|
| Background | `#000000` |
| Primary text | `#FFFFFF` |
| Secondary text | `#888888` |
| Input background | `#111111` |
| Input border | `#222222` |
| Progress track | `#222222` |
| Progress fill | `#FFFFFF` |
| Primary button | White bg, black text |
| Secondary button | Transparent bg, `#333333` border, white text |
| Border radius | `0` (sharp corners everywhere) |
| Font | Inter, weights 400 and 600 only |
| Max content width | `420px` centered |

No gradients. No shadows. No color accents.

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
git clone https://github.com/yourusername/hydrolock.git
cd hydrolock
npm install
```

### Development

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

### Production Build

```bash
npm run build
npm run preview
```

### Deploy

The `dist/` folder after build is a fully static site. Deploy to any static host:

```bash
# Vercel
vercel --prod

# Netlify
netlify deploy --dir=dist --prod

# GitHub Pages
gh-pages -d dist
```

---

## Notification Support

Web Notifications require:
- A browser that supports the Notifications API (Chrome, Edge, Firefox, Safari 16.4+)
- User permission granted (prompted during onboarding)
- The tab to be open (background notifications require a Service Worker — not implemented in this version)

---

## Known Limitations

- **Not a true app locker** — HydroLock cannot lock other apps at the OS level. It works as a full-screen browser overlay and is most effective when set as your browser's default tab or added to your home screen as a PWA
- **Notifications require open tab** — background push notifications without the tab open require a Service Worker, which is not included in this version
- **localStorage only** — data does not sync across devices or browsers

---

## Roadmap

- [ ] PWA manifest + service worker for true home screen install and background notifications
- [ ] Export data as CSV
- [ ] Custom lock messages
- [ ] Multiple profiles
- [ ] Dark/dim screen mode for the lock screen to save battery

---

## License

MIT — do whatever you want with it, just drink water.

