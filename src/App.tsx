import { useState, useEffect, useRef, useCallback } from 'react';

type Screen = 'onboarding' | 'setup' | 'notification_permission' | 'locked' | 'unlocked' | 'goal_complete' | 'stats' | 'settings';

const SK = {
  setupComplete: 'hydrolock_setup_complete',
  dailyGoal: 'hydrolock_daily_goal_ml',
  interval: 'hydrolock_interval_minutes',
  todayDate: 'hydrolock_today_date',
  todayIntake: 'hydrolock_today_intake_ml',
  timerEnd: 'hydrolock_timer_end_timestamp',
  onboarded: 'hydrolock_onboarded',
  userName: 'hydrolock_user_name',
  unit: 'hydrolock_unit',
  weightKg: 'hydrolock_weight_kg',
  streak: 'hydrolock_streak',
  lastGoalMetDate: 'hydrolock_last_goal_met_date',
  history: 'hydrolock_history',
  todayLogEntries: 'hydrolock_today_log_entries',
  notifPermissionAsked: 'hydrolock_notification_permission_asked',
  goalCompleteShownToday: 'hydrolock_goal_complete_shown_today',
} as const;

const INTERVAL_OPTIONS = [
  { label: '00:15', minutes: 15 },
  { label: '00:30', minutes: 30 },
  { label: '00:45', minutes: 45 },
  { label: '01:00', minutes: 60 },
  { label: '01:30', minutes: 90 },
  { label: '02:00', minutes: 120 },
  { label: '03:00', minutes: 180 },
  { label: '04:00', minutes: 240 },
  { label: '06:00', minutes: 360 },
  { label: '08:00', minutes: 480 },
  { label: '12:00', minutes: 720 },
  { label: '24:00', minutes: 1440 },
];

const LOCK_SUBTEXTS = [
  "Dehydration reduces focus by 20%.",
  "Your body is 60% water.",
  "Small sips, big difference.",
  "Drink now. Unlock later.",
  "Water is the only lock pick that works.",
];

function lsGet(key: string, fallback: string = ''): string {
  return localStorage.getItem(key) ?? fallback;
}

function lsSet(key: string, value: string): void {
  localStorage.setItem(key, value);
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

function getHistory(): Record<string, number> {
  try {
    return JSON.parse(lsGet(SK.history, '{}'));
  } catch { return {}; }
}

function getLogEntries(): { time: string; amount: number }[] {
  try {
    return JSON.parse(lsGet(SK.todayLogEntries, '[]'));
  } catch { return []; }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatTimeOfDay(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function getDayLetter(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return ['S','M','T','W','T','F','S'][d.getDay()];
}

function sendNotification(): void {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('HydroLock: Time to drink water \uD83D\uDCA7');
  }
}

function mlToOz(ml: number): number {
  return Math.round(ml / 29.5735);
}

function ozToMl(oz: number): number {
  return Math.round(oz * 29.5735);
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('onboarding');
  const [dailyGoal, setDailyGoal] = useState(2000);
  const [intervalMinutes, setIntervalMinutes] = useState(30);
  const [todayIntake, setTodayIntake] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [logInput, setLogInput] = useState(250);
  const [extraLogOpen, setExtraLogOpen] = useState(false);
  const [extraLogInput, setExtraLogInput] = useState(250);
  const [fade, setFade] = useState(true);
  const [settingsGoal, setSettingsGoal] = useState(2000);
  const [settingsInterval, setSettingsInterval] = useState(30);
  const [userName, setUserName] = useState('');
  const [weightKg, setWeightKg] = useState(70);
  const [unit, setUnit] = useState<'ml' | 'oz'>('ml');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [streak, setStreak] = useState(0);
  const [lockSubtext, setLockSubtext] = useState('');
  const [logEntries, setLogEntries] = useState<{ time: string; amount: number }[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerEndRef = useRef<number | null>(null);
  const goalCompleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const transitionTo = useCallback((next: Screen) => {
    setFade(false);
    setTimeout(() => {
      setScreen(next);
      setFade(true);
    }, 200);
  }, []);

  const addLogEntry = useCallback((amount: number) => {
    const entry = { time: formatTimeOfDay(new Date()), amount };
    const entries = [...getLogEntries(), entry];
    setLogEntries(entries);
    lsSet(SK.todayLogEntries, JSON.stringify(entries));
  }, []);

  const checkGoalComplete = useCallback((newTotal: number, goal: number) => {
    if (newTotal >= goal && lsGet(SK.goalCompleteShownToday) !== 'true') {
      lsSet(SK.goalCompleteShownToday, 'true');
      lsSet(SK.lastGoalMetDate, getTodayDate());
      const h = getHistory();
      h[getTodayDate()] = newTotal;
      lsSet(SK.history, JSON.stringify(h));
      transitionTo('goal_complete');
      return true;
    }
    return false;
  }, [transitionTo]);

  const persistIntake = useCallback((ml: number) => {
    const newTotal = todayIntake + ml;
    setTodayIntake(newTotal);
    lsSet(SK.todayIntake, String(newTotal));
    const h = getHistory();
    h[getTodayDate()] = newTotal;
    lsSet(SK.history, JSON.stringify(h));
    addLogEntry(ml);
    checkGoalComplete(newTotal, dailyGoal);
  }, [todayIntake, dailyGoal, addLogEntry, checkGoalComplete]);

  const startTimer = useCallback((minutes: number) => {
    const end = Date.now() + minutes * 60 * 1000;
    lsSet(SK.timerEnd, String(end));
    timerEndRef.current = end;
  }, []);

  // Initialize on mount
  useEffect(() => {
    const today = getTodayDate();
    const storedDate = lsGet(SK.todayDate);
    const goal = parseInt(lsGet(SK.dailyGoal, '2000'), 10);
    const intv = parseInt(lsGet(SK.interval, '30'), 10);
    const name = lsGet(SK.userName, '');
    const weight = parseInt(lsGet(SK.weightKg, '70'), 10);
    const u = (lsGet(SK.unit, 'ml') as 'ml' | 'oz');
    const currentStreak = parseInt(lsGet(SK.streak, '0'), 10);

    setDailyGoal(goal);
    setSettingsGoal(goal);
    setIntervalMinutes(intv);
    setSettingsInterval(intv);
    setUserName(name);
    setWeightKg(weight);
    setUnit(u);
    setStreak(currentStreak);
    setLogEntries(getLogEntries());

    // New day logic
    if (storedDate !== today) {
      const history = getHistory();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yd = yesterday.toISOString().split('T')[0];
      const yesterdayIntake = history[yd] || 0;
      const yesterdayGoal = parseInt(lsGet(SK.dailyGoal, '2000'), 10);

      let newStreak = currentStreak;
      if (yesterdayIntake >= yesterdayGoal) {
        newStreak = currentStreak + 1;
      } else if (storedDate) {
        newStreak = 0;
      }
      lsSet(SK.streak, String(newStreak));
      setStreak(newStreak);

      lsSet(SK.todayDate, today);
      lsSet(SK.todayIntake, '0');
      lsSet(SK.todayLogEntries, '[]');
      lsSet(SK.goalCompleteShownToday, 'false');
      setTodayIntake(0);
      setLogEntries([]);
    } else {
      setTodayIntake(parseInt(lsGet(SK.todayIntake, '0'), 10));
    }

    // Determine screen
    const onboarded = lsGet(SK.onboarded) === 'true';
    if (!onboarded) {
      setScreen('onboarding');
      setFade(true);
      return;
    }

    const setupDone = lsGet(SK.setupComplete) === 'true';
    if (!setupDone) {
      setScreen('setup');
      setFade(true);
      return;
    }

    const timerEnd = lsGet(SK.timerEnd);
    if (timerEnd) {
      const end = parseInt(timerEnd, 10);
      const remaining = Math.max(0, Math.floor((end - Date.now()) / 1000));
      if (remaining > 0) {
        timerEndRef.current = end;
        setTimeLeft(remaining);
        setScreen('unlocked');
      } else {
        localStorage.removeItem(SK.timerEnd);
        setScreen('locked');
      }
    } else {
      setScreen('locked');
    }
    setFade(true);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (screen !== 'unlocked' || !timerEndRef.current) return;

    const tick = () => {
      if (!timerEndRef.current) return;
      const remaining = Math.max(0, Math.floor((timerEndRef.current - Date.now()) / 1000));
      setTimeLeft(remaining);

      if (remaining <= 0) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        timerEndRef.current = null;
        localStorage.removeItem(SK.timerEnd);
        sendNotification();
        transitionTo('locked');
      }
    };

    tick();
    intervalRef.current = setInterval(tick, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [screen, transitionTo]);

  // Cleanup goal complete timer
  useEffect(() => {
    return () => {
      if (goalCompleteTimerRef.current) {
        clearTimeout(goalCompleteTimerRef.current);
      }
    };
  }, []);

  // --- ONBOARDING ---
  const handleOnboarding = () => {
    lsSet(SK.onboarded, 'true');
    transitionTo('setup');
  };

  // --- SETUP ---
  const handleSetup = () => {
    lsSet(SK.setupComplete, 'true');
    lsSet(SK.dailyGoal, String(dailyGoal));
    lsSet(SK.interval, String(intervalMinutes));
    lsSet(SK.userName, userName);
    lsSet(SK.weightKg, String(weightKg));
    lsSet(SK.unit, unit);
    lsSet(SK.todayDate, getTodayDate());
    lsSet(SK.todayIntake, '0');
    lsSet(SK.todayLogEntries, '[]');
    lsSet(SK.goalCompleteShownToday, 'false');
    setTodayIntake(0);
    setLogEntries([]);

    if (notificationsEnabled && lsGet(SK.notifPermissionAsked) !== 'true') {
      transitionTo('notification_permission');
    } else {
      transitionTo('locked');
    }
  };

  // --- NOTIFICATION PERMISSION ---
  const handleEnableNotif = () => {
    if ('Notification' in window) {
      Notification.requestPermission();
    }
    lsSet(SK.notifPermissionAsked, 'true');
    transitionTo('locked');
  };

  const handleSkipNotif = () => {
    lsSet(SK.notifPermissionAsked, 'true');
    transitionTo('locked');
  };

  // --- LOCK SCREEN ---
  const handleUnlock = () => {
    const newTotal = todayIntake + logInput;
    setTodayIntake(newTotal);
    lsSet(SK.todayIntake, String(newTotal));
    const h = getHistory();
    h[getTodayDate()] = newTotal;
    lsSet(SK.history, JSON.stringify(h));
    addLogEntry(logInput);

    startTimer(intervalMinutes);
    setTimeLeft(intervalMinutes * 60);

    if (!checkGoalComplete(newTotal, dailyGoal)) {
      transitionTo('unlocked');
    }
  };

  const handleGoalMetUnlock = () => {
    startTimer(intervalMinutes);
    setTimeLeft(intervalMinutes * 60);
    transitionTo('unlocked');
  };

  // --- EXTRA LOG ---
  const handleExtraLog = () => {
    if (extraLogInput > 0) {
      const newTotal = todayIntake + extraLogInput;
      setTodayIntake(newTotal);
      lsSet(SK.todayIntake, String(newTotal));
      const h = getHistory();
      h[getTodayDate()] = newTotal;
      lsSet(SK.history, JSON.stringify(h));
      addLogEntry(extraLogInput);
      setExtraLogInput(250);
      setExtraLogOpen(false);
      checkGoalComplete(newTotal, dailyGoal);
    }
  };

  // --- SETTINGS ---
  const handleSaveSettings = () => {
    setDailyGoal(settingsGoal);
    setIntervalMinutes(settingsInterval);
    lsSet(SK.dailyGoal, String(settingsGoal));
    lsSet(SK.interval, String(settingsInterval));
    transitionTo('unlocked');
  };

  const handleResetToday = () => {
    setTodayIntake(0);
    lsSet(SK.todayIntake, '0');
    lsSet(SK.todayLogEntries, '[]');
    lsSet(SK.goalCompleteShownToday, 'false');
    setLogEntries([]);
  };

  // --- GOAL COMPLETE ---
  useEffect(() => {
    if (screen === 'goal_complete') {
      goalCompleteTimerRef.current = setTimeout(() => {
        transitionTo('unlocked');
      }, 4000);
      return () => {
        if (goalCompleteTimerRef.current) {
          clearTimeout(goalCompleteTimerRef.current);
        }
      };
    }
  }, [screen, transitionTo]);

  const goalMet = todayIntake >= dailyGoal;
  const progress = dailyGoal > 0 ? Math.min(1, todayIntake / dailyGoal) : 0;
  const recommendedGoal = weightKg * 33;

  const displayValue = (ml: number) => unit === 'oz' ? `${mlToOz(ml)} oz` : `${ml} ml`;

  const getHydrationStatus = () => {
    const pct = dailyGoal > 0 ? (todayIntake / dailyGoal) * 100 : 0;
    if (pct >= 91) return '\u2713 Well hydrated';
    if (pct >= 61) return '\u2192 On track';
    if (pct >= 31) return '\u2193 Falling behind';
    return '\u26A0 Critically low';
  };

  const getTodayFormatted = () => {
    const d = new Date();
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
  };

  const getLast7Days = () => {
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split('T')[0]);
    }
    return days;
  };

  const getStatsSummary = () => {
    const history = getHistory();
    const entries = Object.entries(history);
    let best = 0;
    let total = 0;
    let count = 0;
    entries.forEach(([, ml]) => {
      if (ml > best) best = ml;
      total += ml;
      count++;
    });
    const weeklyAvg = count > 0 ? Math.round(total / Math.max(count, 1)) : 0;
    return { best, weeklyAvg, streak: parseInt(lsGet(SK.streak, '0'), 10) };
  };

  const pickLockSubtext = () => {
    return LOCK_SUBTEXTS[Math.floor(Math.random() * LOCK_SUBTEXTS.length)];
  };

  // When entering lock screen, pick a new subtext
  useEffect(() => {
    if (screen === 'locked') {
      setLockSubtext(pickLockSubtext());
    }
  }, [screen]);

  const renderPlusMinusRow = (value: number, setValue: (v: number) => void, step: number = 50, min: number = 50) => (
    <div className="flex items-center gap-0 w-full">
      <button
        onClick={() => setValue(Math.max(min, value - step))}
        className="w-10 h-10 border border-white text-white flex items-center justify-center text-lg flex-shrink-0 bg-transparent"
      >
        &minus;
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(Math.max(min, parseInt(e.target.value, 10) || min))}
        className="flex-1 bg-[#111111] border border-[#222222] text-white py-[10px] text-center text-base outline-none"
      />
      <button
        onClick={() => setValue(value + step)}
        className="w-10 h-10 border border-white text-white flex items-center justify-center text-lg flex-shrink-0 bg-transparent"
      >
        +
      </button>
    </div>
  );

  return (
    <div
      className="h-screen w-screen bg-black flex items-center justify-center overflow-hidden"
      style={{ opacity: fade ? 1 : 0, transition: 'opacity 200ms ease' }}
    >
      <div className="w-full max-w-[420px] px-6 h-full flex flex-col">

        {screen === 'onboarding' && (
          <div className="flex flex-col items-center h-full relative">
            <p
              className="text-[#888888] text-xs tracking-[0.3em] pt-12"
              style={{ fontVariant: 'small-caps' }}
            >
              HYDROLOCK
            </p>

            <div className="flex-1 flex flex-col justify-center text-center px-2">
              <h1 className="text-white font-semibold text-[36px] leading-[1.2] mb-6">
                Your phone stays locked. Until you drink.
              </h1>
              <div className="space-y-3">
                <p className="text-[#888888] text-sm" style={{ animation: 'fadeIn 300ms ease both', animationDelay: '0ms' }}>
                  &mdash; Set your daily water goal
                </p>
                <p className="text-[#888888] text-sm" style={{ animation: 'fadeIn 300ms ease both', animationDelay: '300ms' }}>
                  &mdash; Lock interval you control
                </p>
                <p className="text-[#888888] text-sm" style={{ animation: 'fadeIn 300ms ease both', animationDelay: '600ms' }}>
                  &mdash; Unlock only after you drink
                </p>
              </div>
            </div>

            <div className="pb-12 w-full">
              <button
                onClick={handleOnboarding}
                className="w-full bg-white text-black font-semibold py-4 text-base"
              >
                Get Started
              </button>
            </div>
          </div>
        )}

        {screen === 'setup' && (
          <div className="flex flex-col overflow-y-auto py-8 flex-1">
            <h1 className="text-white font-semibold text-[28px] mb-8">
              Set up HydroLock
            </h1>

            {/* Name */}
            <div className="mb-6">
              <label className="block text-[#888888] text-xs uppercase tracking-[0.1em] mb-2">
                Your name
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter your name"
                className="w-full bg-[#111111] border border-[#222222] text-white py-[14px] px-4 text-base outline-none"
              />
            </div>

            {/* Weight */}
            <div className="mb-6">
              <label className="block text-[#888888] text-xs uppercase tracking-[0.1em] mb-2">
                Your weight (kg)
              </label>
              <input
                type="number"
                value={weightKg}
                onChange={(e) => setWeightKg(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full bg-[#111111] border border-[#222222] text-white py-[14px] px-4 text-base outline-none"
              />
              <p className="text-[#888888] text-sm mt-2">
                Recommended for you: {recommendedGoal} ml
              </p>
            </div>

            {/* Unit toggle */}
            <div className="mb-6">
              <label className="block text-[#888888] text-xs uppercase tracking-[0.1em] mb-2">
                Unit
              </label>
              <div className="flex w-full">
                <button
                  onClick={() => setUnit('ml')}
                  className={`flex-1 py-3 text-base font-semibold ${
                    unit === 'ml'
                      ? 'bg-white text-black'
                      : 'bg-transparent text-white border border-[#333333]'
                  }`}
                >
                  ml
                </button>
                <button
                  onClick={() => setUnit('oz')}
                  className={`flex-1 py-3 text-base font-semibold ${
                    unit === 'oz'
                      ? 'bg-white text-black'
                      : 'bg-transparent text-white border border-[#333333]'
                  }`}
                >
                  oz
                </button>
              </div>
            </div>

            {/* Daily goal */}
            <div className="mb-6">
              <label className="block text-[#888888] text-xs uppercase tracking-[0.1em] mb-2">
                Daily goal &mdash; {unit === 'oz' ? mlToOz(dailyGoal) : dailyGoal} {unit}
              </label>
              <input
                type="range"
                min={unit === 'oz' ? 17 : 500}
                max={unit === 'oz' ? 135 : 10000}
                step={unit === 'oz' ? 1 : 50}
                value={unit === 'oz' ? mlToOz(dailyGoal) : dailyGoal}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setDailyGoal(unit === 'oz' ? ozToMl(v) : v);
                }}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-[#888888] mt-2">
                <span>{unit === 'oz' ? 17 : 500}</span>
                <span>{unit === 'oz' ? 135 : 10000}</span>
              </div>
            </div>

            {/* Lock interval */}
            <div className="mb-6">
              <label className="block text-[#888888] text-xs uppercase tracking-[0.1em] mb-2">
                Lock interval
              </label>
              <select
                value={intervalMinutes}
                onChange={(e) => setIntervalMinutes(parseInt(e.target.value, 10))}
                className="w-full bg-[#111111] border border-[#222222] text-white py-3 px-4 text-base outline-none"
              >
                {INTERVAL_OPTIONS.map((opt) => (
                  <option key={opt.minutes} value={opt.minutes}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Notifications toggle */}
            <div className="mb-10 flex items-center justify-between">
              <span className="text-white text-base">Enable reminders</span>
              <button
                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                className="relative w-12 h-7 transition-colors duration-200"
                style={{ backgroundColor: notificationsEnabled ? '#FFFFFF' : '#333333' }}
              >
                <div
                  className="absolute top-[3px] w-[20px] h-[20px] rounded-full transition-all duration-200"
                  style={{
                    backgroundColor: notificationsEnabled ? '#000000' : '#888888',
                    left: notificationsEnabled ? '26px' : '3px',
                  }}
                />
              </button>
            </div>

            <button
              onClick={handleSetup}
              className="w-full bg-white text-black font-semibold py-4 text-base mt-2"
            >
              Start HydroLock
            </button>
          </div>
        )}

        {screen === 'notification_permission' && (
          <div className="flex flex-col items-center text-center h-full">
            <div className="flex-1 flex flex-col items-center justify-center">
              {/* Bell icon */}
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mt-20">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>

              <h2 className="text-white font-semibold text-[32px] mt-6">
                Stay on track.
              </h2>
              <p className="text-[#888888] text-[15px] mt-4 max-w-[280px]">
                HydroLock sends you a reminder each time your lock interval ends. No spam &mdash; just water.
              </p>
            </div>

            <div className="pb-12 w-full space-y-3">
              <button
                onClick={handleEnableNotif}
                className="w-full bg-white text-black font-semibold py-4 text-base"
              >
                Enable Notifications
              </button>
              <button
                onClick={handleSkipNotif}
                className="w-full bg-transparent border border-[#333333] text-white py-4 text-base"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}

        {screen === 'locked' && (
          <div className="flex flex-col items-center text-center h-full relative">
            {/* Streak */}
            <div className="absolute top-6 right-0 text-[#888888] text-xs">
              {'\uD83D\uDD25'} {streak} day streak
            </div>

            <div className="flex-1 flex flex-col items-center justify-center">
              {/* Water drop icon */}
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
              </svg>

              <h1 className="text-white font-semibold text-[28px] mt-4">
                Hey{userName ? ` ${userName}` : ''}, time to drink water.
              </h1>
              <p className="text-[#888888] text-sm mt-2">
                {lockSubtext}
              </p>

              {/* Progress */}
              <p className="text-white text-base mt-10">
                {displayValue(todayIntake)} / {displayValue(dailyGoal)}
              </p>
              <div className="w-full h-[4px] bg-[#222222] mt-2">
                <div
                  className="h-full bg-white transition-all duration-300"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>

              {/* Input */}
              {!goalMet ? (
                <div className="w-full mt-8">
                  <label className="block text-[#888888] text-xs uppercase tracking-[0.1em] mb-3 text-left">
                    How much did you drink?
                  </label>
                  {renderPlusMinusRow(logInput, setLogInput)}
                  <button
                    onClick={handleUnlock}
                    className="w-full bg-white text-black font-semibold py-4 text-base mt-6"
                  >
                    I drank it &mdash; Unlock
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleGoalMetUnlock}
                  className="w-full bg-white text-black font-semibold py-4 text-base mt-8"
                >
                  Goal met {'\u2713'} &mdash; Unlock
                </button>
              )}
            </div>
          </div>
        )}

        {screen === 'unlocked' && (
          <div className="flex flex-col h-full overflow-y-auto">
            {/* Top row */}
            <div className="flex items-center justify-between pt-6">
              <p className="text-[#888888] text-[13px]">{getTodayFormatted()}</p>
              <button
                onClick={() => {
                  setSettingsGoal(dailyGoal);
                  setSettingsInterval(intervalMinutes);
                  transitionTo('settings');
                }}
                className="text-white"
                aria-label="Settings"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
            </div>

            {/* Hydration status */}
            <p className="text-white text-[13px] tracking-[0.05em] text-center mt-2">
              {getHydrationStatus()}
            </p>

            {/* Countdown */}
            <div className="text-center mt-12">
              <p className="text-[#888888] text-xs uppercase tracking-[0.1em] mb-2">
                Next lock in
              </p>
              <div
                className="font-semibold tracking-tight"
                style={{ fontSize: 'min(80px, 15vw)', lineHeight: 1 }}
              >
                {formatTime(timeLeft)}
              </div>
            </div>

            {/* Progress */}
            <div className="text-center mt-8">
              <p className="text-white text-[15px]">
                {displayValue(todayIntake)} / {displayValue(dailyGoal)}
              </p>
              <div className="w-full h-[4px] bg-[#222222] mt-2">
                <div
                  className="h-full bg-white transition-all duration-300"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>

            {/* Streak */}
            <p className="text-[#888888] text-[13px] text-center mt-4">
              {'\uD83D\uDD25'} {streak} day streak
            </p>

            {/* Log more water */}
            <div className="mt-8">
              {!extraLogOpen ? (
                <button
                  onClick={() => setExtraLogOpen(true)}
                  className="w-full bg-transparent border border-[#333333] text-white py-4 text-base"
                >
                  + Log more water
                </button>
              ) : (
                <div>
                  {renderPlusMinusRow(extraLogInput, setExtraLogInput)}
                  <button
                    onClick={handleExtraLog}
                    className="w-full bg-white text-black font-semibold py-4 text-base mt-3"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

            {/* Today's log */}
            <div className="mt-8">
              <p className="text-[#888888] text-[11px] uppercase tracking-[0.1em] mb-3">
                Today
              </p>
              {logEntries.length === 0 ? (
                <p className="text-[#888888] text-[13px] text-center">No logs yet.</p>
              ) : (
                <div>
                  {logEntries.map((entry, i) => (
                    <div
                      key={i}
                      className="flex justify-between text-[#888888] text-[13px] py-[10px] border-b border-[#111111]"
                    >
                      <span>{entry.time}</span>
                      <span>{entry.amount} ml</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* View history */}
            <div className="text-center mt-6 pb-8">
              <button
                onClick={() => transitionTo('stats')}
                className="text-[#888888] text-xs hover:text-white transition-colors"
              >
                View history &rarr;
              </button>
            </div>
          </div>
        )}

        {screen === 'goal_complete' && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            {/* Animated ring */}
            <svg width="120" height="120" viewBox="0 0 120 120" className="mb-0">
              <circle
                cx="60" cy="60" r="54"
                fill="none"
                stroke="#222222"
                strokeWidth="3"
              />
              <circle
                cx="60" cy="60" r="54"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={339.292}
                strokeDashoffset={0}
                className="ring-animate"
                transform="rotate(-90 60 60)"
              />
              <text
                x="60" y="60"
                textAnchor="middle"
                dominantBaseline="central"
                fill="white"
                fontSize="32"
                fontWeight="600"
                className="check-animate"
              >
                {'\u2713'}
              </text>
            </svg>

            <h2 className="text-white font-semibold text-[32px] mt-8">
              Goal reached.
            </h2>
            <p className="text-[#888888] text-[15px] mt-2">
              {displayValue(todayIntake)} consumed today
            </p>
            <p className="text-white text-sm mt-2">
              {'\uD83D\uDD25'} {streak} day streak
            </p>
            <p className="text-[#888888] text-sm mt-1">
              Completed in {logEntries.length} sessions today
            </p>

            <button
              onClick={() => transitionTo('unlocked')}
              className="w-full bg-transparent border border-[#333333] text-white py-4 text-base mt-10"
            >
              Continue &rarr;
            </button>
          </div>
        )}

        {screen === 'stats' && (
          <div className="flex flex-col h-full overflow-y-auto py-6">
            {/* Header */}
            <div className="flex items-center mb-10">
              <button
                onClick={() => transitionTo('unlocked')}
                className="text-[#888888] hover:text-white transition-colors mr-4"
                aria-label="Back"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-white font-semibold text-2xl flex-1 text-center pr-8">
                History
              </h2>
            </div>

            {/* Last 7 days chart */}
            <div className="mb-10">
              <p className="text-[#888888] text-[11px] uppercase tracking-[0.1em] mb-4">
                Last 7 days
              </p>
              <div className="flex justify-between items-end" style={{ height: '110px' }}>
                {getLast7Days().map((dateStr) => {
                  const history = getHistory();
                  const intake = history[dateStr] || 0;
                  const pct = dailyGoal > 0 ? Math.min(1, intake / dailyGoal) : 0;
                  const barHeight = Math.max(2, pct * 80);
                  const metGoal = intake >= dailyGoal && intake > 0;

                  return (
                    <div key={dateStr} className="flex flex-col items-center" style={{ width: '14%' }}>
                      <span className="text-[#888888] text-[11px] mb-2">
                        {getDayLetter(dateStr)}
                      </span>
                      <div className="w-6 bg-[#1a1a1a] relative" style={{ height: '80px' }}>
                        <div
                          className="absolute bottom-0 w-full bg-white"
                          style={{ height: `${barHeight}px` }}
                        />
                      </div>
                      <div className="mt-1">
                        {metGoal ? (
                          <div className="w-2 h-2 rounded-full bg-white mx-auto" />
                        ) : (
                          <div className="w-2 h-2 rounded-full border border-white mx-auto" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Summary stats */}
            {(() => {
              const stats = getStatsSummary();
              return (
                <div className="flex mb-10">
                  <div className="flex-1 text-center">
                    <p className="text-white font-semibold text-xl">{stats.best > 0 ? displayValue(stats.best) : '0'}</p>
                    <p className="text-[#888888] text-[11px] uppercase mt-1">Best day</p>
                  </div>
                  <div className="w-px bg-[#222222]" />
                  <div className="flex-1 text-center">
                    <p className="text-white font-semibold text-xl">{stats.streak}</p>
                    <p className="text-[#888888] text-[11px] uppercase mt-1">Current streak</p>
                  </div>
                  <div className="w-px bg-[#222222]" />
                  <div className="flex-1 text-center">
                    <p className="text-white font-semibold text-xl">{stats.weeklyAvg > 0 ? displayValue(stats.weeklyAvg) : '0'}</p>
                    <p className="text-[#888888] text-[11px] uppercase mt-1">Weekly avg</p>
                  </div>
                </div>
              );
            })()}

            {/* All time log */}
            <div className="pb-8">
              <p className="text-[#888888] text-[11px] uppercase tracking-[0.1em] mb-4">
                All time
              </p>
              {(() => {
                const history = getHistory();
                const entries = Object.entries(history).sort((a, b) => b[0].localeCompare(a[0]));
                if (entries.length === 0) {
                  return <p className="text-[#888888] text-[13px] text-center">No history yet.</p>;
                }
                return entries.map(([date, ml]) => {
                  const metGoal = ml >= dailyGoal && ml > 0;
                  return (
                    <div
                      key={date}
                      className="flex items-center justify-between py-3 border-b border-[#111111]"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${metGoal ? 'bg-white' : 'border border-white'}`} />
                        <span className="text-[#888888] text-[13px]">{formatDateShort(date)}</span>
                      </div>
                      <span className="text-[#888888] text-[13px]">{displayValue(ml)}</span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {screen === 'settings' && (
          <div className="flex flex-col overflow-y-auto py-6 flex-1">
            <button
              onClick={() => transitionTo('unlocked')}
              className="text-[#888888] hover:text-white transition-colors mb-8 self-start"
              aria-label="Back"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>

            <h2 className="text-2xl font-semibold mb-10">Settings</h2>

            <div className="mb-10">
              <div className="text-[#888888] text-xs uppercase tracking-[0.1em] mb-2">Daily goal</div>
              <div className="text-2xl font-semibold mb-4">{displayValue(settingsGoal)}</div>
              <input
                type="range"
                min={unit === 'oz' ? 17 : 500}
                max={unit === 'oz' ? 135 : 10000}
                step={unit === 'oz' ? 1 : 50}
                value={unit === 'oz' ? mlToOz(settingsGoal) : settingsGoal}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setSettingsGoal(unit === 'oz' ? ozToMl(v) : v);
                }}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-[#888888] mt-2">
                <span>{unit === 'oz' ? 17 : 500}</span>
                <span>{unit === 'oz' ? 135 : 10000}</span>
              </div>
            </div>

            <div className="mb-10">
              <label className="block text-[#888888] text-xs uppercase tracking-[0.1em] mb-2">
                Lock interval
              </label>
              <select
                value={settingsInterval}
                onChange={(e) => setSettingsInterval(parseInt(e.target.value, 10))}
                className="w-full bg-[#111111] border border-[#222222] text-white py-3 px-4 text-base outline-none"
              >
                {INTERVAL_OPTIONS.map((opt) => (
                  <option key={opt.minutes} value={opt.minutes}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleResetToday}
              className="w-full bg-transparent border border-[#333333] text-white py-4 text-base mb-4"
            >
              Reset today's progress
            </button>

            <button
              onClick={handleSaveSettings}
              className="w-full bg-white text-black font-semibold py-4 text-base"
            >
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
