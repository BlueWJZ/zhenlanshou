"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ENCOURAGEMENTS,
  EXERCISES,
  FOOD_LIBRARY,
  SINGLE_FOODS,
  TFDA_FOODS,
  type Food,
} from "./data";
import {
  FOOD_FILTERS,
  getDefaultFoodSelection,
  matchesFoodFilter,
} from "./food-browser";
import {
  composeProfileWeight,
  PROFILE_AGE_OPTIONS,
  PROFILE_HEIGHT_OPTIONS,
  PROFILE_WEIGHT_TENTH_OPTIONS,
  PROFILE_WEIGHT_WHOLE_OPTIONS,
  splitProfileWeight,
} from "./profile-controls";
import {
  foodFromOpenFoodFacts,
  getFoodSourceMeta,
  parseFoodText,
  parseNutritionLabel,
  type ParsedFoodItem,
} from "./food-resolver";
import {
  calculateEnergyTotals,
  calculateExerciseCalories,
  getDueReminders,
} from "./domain";
import {
  calculateDailyDeficit,
  getCalendarMonthDates,
  getWeightOnDate,
  shiftMonthKey,
  upsertWeightLog,
} from "./calendar";
import {
  buildMealPlan,
  MEAL_PLAN_PREFERENCES,
  type MealPlanPreference,
} from "./meal-plan";
import {
  APP_STORAGE_KEY,
  BARCODE_CACHE_KEY,
  createBackupPayload,
  INITIAL_STATE,
  LEGACY_STORAGE_KEY,
  normalizeAppState,
  RECOVERY_STORAGE_KEY,
  restoreBackupText,
  THEME_STORAGE_KEY,
  type AppState,
  type Combo,
  type FoodLog,
  type GoalMode,
  type MealType,
  type Profile,
  type Recipe,
  type SleepLog,
} from "./state";

const CURATED_FOODS = [...SINGLE_FOODS, ...FOOD_LIBRARY];
const ALL_FOODS = [...CURATED_FOODS, ...TFDA_FOODS];
type SmartFoodMode = "text" | "barcode" | "label";
const dateKey = (d = new Date()) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const dateFromKey = (key: string) => new Date(`${key}T12:00:00`);
const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));
const lastDays = (count: number) =>
  Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (count - 1 - i));
    return dateKey(d);
  });
const inferMeal = (): MealType => {
  const hour = new Date().getHours();
  return hour < 10 ? "早餐" : hour < 15 ? "午餐" : hour < 21 ? "晚餐" : "點心";
};
const waterTarget = (profile: Profile) =>
  clamp(Math.round((profile.weight * 30) / 100) * 100, 1800, 3500);
const safeStorageGet = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const safeStorageSet = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};
const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

export default function Home() {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<"today" | "history">("today");
  const [selectedDate, setSelectedDate] = useState(dateKey());
  const [foodMode, setFoodMode] = useState<
    "browse" | "recent" | "favorites"
  >("browse");
  const [foodFilter, setFoodFilter] = useState("全部");
  const [search, setSearch] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [quote, setQuote] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [smartOpen, setSmartOpen] = useState(false);
  const [smartMode, setSmartMode] = useState<SmartFoodMode>("text");
  const [exerciseOpen, setExerciseOpen] = useState(false);
  const [editing, setEditing] = useState<FoodLog | null>(null);
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [reporting, setReporting] = useState<Food | null>(null);
  const [proOpen, setProOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [planSeed, setPlanSeed] = useState(0);
  const [planPreference, setPlanPreference] =
    useState<MealPlanPreference>("auto");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() =>
    dateKey().slice(0, 7),
  );
  const [toast, setToast] = useState("");
  const toastTimerRef = useRef<number | null>(null);
  const deliveredReminderRef = useRef(new Set<string>());
  const storageFailureNotifiedRef = useRef(false);
  const notify = useCallback((message: string, duration = 2300) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = window.setTimeout(() => {
      setToast("");
      toastTimerRef.current = null;
    }, duration);
  }, []);

  useEffect(
    () => () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!calendarOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCalendarOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [calendarOpen]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      let recoveryMessage = "";
      try {
        const saved =
          safeStorageGet(APP_STORAGE_KEY) || safeStorageGet(LEGACY_STORAGE_KEY);
        if (saved) setState(normalizeAppState(JSON.parse(saved)));
        else setProfileOpen(true);
        if (safeStorageGet(THEME_STORAGE_KEY) === "dark") setTheme("dark");
      } catch {
        const broken = safeStorageGet(APP_STORAGE_KEY);
        if (broken) safeStorageSet(RECOVERY_STORAGE_KEY, broken);
        try {
          localStorage.removeItem(APP_STORAGE_KEY);
        } catch {
          // 儲存空間不可用時仍可繼續以目前工作階段使用。
        }
        setProfileOpen(true);
        recoveryMessage = "偵測到損壞的舊資料，已安全重設並保留復原副本。";
      }
      setQuote(Math.floor(Math.random() * ENCOURAGEMENTS.length));
      setLoaded(true);
      if (recoveryMessage) notify(recoveryMessage, 5000);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [notify]);
  useEffect(() => {
    if (
      loaded &&
      !safeStorageSet(APP_STORAGE_KEY, JSON.stringify(state)) &&
      !storageFailureNotifiedRef.current
    ) {
      storageFailureNotifiedRef.current = true;
      const timer = window.setTimeout(
        () =>
          notify(
            "無法儲存資料：裝置空間不足或瀏覽器封鎖了儲存功能。",
            5000,
          ),
        0,
      );
      return () => window.clearTimeout(timer);
    }
  }, [state, loaded, notify]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (loaded) safeStorageSet(THEME_STORAGE_KEY, theme);
  }, [theme, loaded]);
  useEffect(() => {
    if (
      !loaded ||
      !state.reminders.notificationsEnabled ||
      (!state.reminders.enabled && !state.reminders.waterEnabled)
    )
      return;
    const check = () => {
      const now = new Date();
      const hits = getDueReminders(state.reminders, now);
      hits.forEach((hit) => {
        const key = `trueblue-reminder-${dateKey(now)}-${hit.scheduledTime}-${hit.id}`;
        if (deliveredReminderRef.current.has(key) || safeStorageGet(key)) return;
        deliveredReminderRef.current.add(key);
        safeStorageSet(key, "1");
        notify(hit.message, 4000);
        if ("Notification" in window && Notification.permission === "granted") {
          try {
            new Notification("真藍瘦提醒", { body: hit.message });
          } catch {
            // 系統通知失敗時，畫面內提醒仍然會顯示。
          }
        }
      });
    };
    check();
    const timer = window.setInterval(check, 30000);
    return () => window.clearInterval(timer);
  }, [loaded, notify, state.reminders]);

  const today = dateKey();
  const logDate = selectedDate;
  const dayFoods = state.foods.filter((x) => x.date === logDate);
  const dayExercises = state.exercises.filter((x) => x.date === logDate);
  const totals = useMemo(
    () => calculateEnergyTotals(state.profile, dayFoods, dayExercises),
    [state.profile, dayFoods, dayExercises],
  );
  const remaining = Math.max(0, totals.targetCalories - totals.intake);
  const recentFoods = useMemo(() => {
    const ids = [...state.foods].reverse().map((x) => x.id);
    return [...new Set(ids)]
      .map(
        (id) =>
          ALL_FOODS.find((x) => x.id === id) ||
          state.foods.find((x) => x.id === id),
      )
      .filter(Boolean) as Food[];
  }, [state.foods]);
  const baseLibrary =
    foodMode === "browse"
      ? CURATED_FOODS
      : foodMode === "recent"
        ? recentFoods
        : (state.favorites
            .map(
              (id) =>
                ALL_FOODS.find((x) => x.id === id) ||
                state.foods.find((f) => f.id === id),
            )
            .filter(Boolean) as Food[]);
  const searchLibrary = search.trim() ? ALL_FOODS : baseLibrary;
  const matched = searchLibrary.filter((f) => {
    const filter = matchesFoodFilter(f, foodFilter);
    const hay =
      `${f.name} ${f.source} ${f.category} ${(f.aliases || []).join(" ")}`.toLowerCase();
    return filter && hay.includes(search.trim().toLowerCase());
  });
  const visibleFoods = search.trim()
    ? matched.slice(0, 80)
    : getDefaultFoodSelection(
        matched,
        foodMode === "browse" ? foodFilter : "個人清單",
      );
  const water = state.water[logDate] || 0;
  const dailyWaterTarget = waterTarget(state.profile);
  const sleep = state.sleep[logDate] || { hours: 7, quality: "良好" as const };
  const dayLabel = logDate === today ? "今日" : "當日";

  const openSmartFood = (mode: SmartFoodMode) => {
    setSmartMode(mode);
    setSmartOpen(true);
  };

  const addFood = (food: Food, meal: MealType = inferMeal()) => {
    setState((s) => ({
      ...s,
      foods: [
        ...s.foods,
        {
          ...food,
          logId: uid(),
          date: logDate,
          servings: 1,
          meal,
        },
      ],
    }));
    notify(`已記錄「${food.name}」`);
  };
  const addParsedFoods = (items: ParsedFoodItem[]) => {
    setState((current) => ({
      ...current,
      foods: [
        ...current.foods,
        ...items.map(({ food, servings }) => ({
          ...food,
          logId: uid(),
          date: logDate,
          servings,
          meal: inferMeal(),
        })),
      ],
    }));
    setSmartOpen(false);
    notify(`已加入 ${items.length} 項餐點`);
  };
  const toggleFavorite = (id: string) =>
    setState((s) => ({
      ...s,
      favorites: s.favorites.includes(id)
        ? s.favorites.filter((x) => x !== id)
        : [...s.favorites, id],
    }));
  const saveCombo = () => {
    const ids = [...new Set(dayFoods.map((x) => x.id))];
    if (!ids.length) return notify("今天還沒有餐點可以儲存");
    const n = state.combos.length + 1;
    setState((s) => ({
      ...s,
      combos: [
        ...s.combos,
        { id: uid(), name: `我的常用組合 ${n}`, foodIds: ids },
      ],
    }));
    notify("已儲存為常用組合");
  };
  const addCombo = (combo: Combo) => {
    const foods = combo.foodIds
      .map(
        (id) =>
          ALL_FOODS.find((x) => x.id === id) ||
          state.foods.find((x) => x.id === id),
      )
      .filter(Boolean) as Food[];
    setState((s) => ({
      ...s,
      foods: [
        ...s.foods,
        ...foods.map((food) => ({
          ...food,
          logId: uid(),
          date: logDate,
          servings: 1,
          meal: inferMeal(),
        })),
      ],
    }));
    notify(`已加入「${combo.name}」`);
  };
  const saveRecipe = (name: string, selectedIds: string[]) => {
    const items = dayFoods.filter((x) => selectedIds.includes(x.logId));
    if (!items.length) return notify("至少選擇一項食材");
    setState((s) => ({
      ...s,
      recipes: [
        ...s.recipes,
        { id: uid(), name, items: items.map((x) => ({ ...x, logId: uid() })) },
      ],
    }));
    setRecipeOpen(false);
    notify(`已建立食譜「${name}」`);
  };
  const addRecipe = (recipe: Recipe) => {
    setState((s) => ({
      ...s,
      foods: [
        ...s.foods,
        ...recipe.items.map((x) => ({ ...x, logId: uid(), date: logDate })),
      ],
    }));
    notify(`已加入食譜「${recipe.name}」`);
  };
  const saveReport = (message: string) => {
    if (!reporting) return;
    setState((s) => ({
      ...s,
      reports: [
        ...s.reports,
        {
          id: uid(),
          foodId: reporting.id,
          foodName: reporting.name,
          message,
          date: new Date().toISOString(),
        },
      ],
    }));
    setReporting(null);
    notify("謝謝回報，已儲存在資料校正清單");
  };
  const exportData = () => {
    const rows = [
      ["類型", "日期", "名稱", "份量/分鐘", "熱量", "蛋白質", "碳水", "脂肪"],
      ...state.foods.map((x) => [
        "飲食",
        x.date,
        x.name,
        x.servings,
        Math.round(x.kcal * x.servings),
        Math.round(x.protein * x.servings),
        Math.round(x.carbs * x.servings),
        Math.round(x.fat * x.servings),
      ]),
      ...state.exercises.map((x) => [
        "運動",
        x.date,
        x.name,
        x.minutes,
        -x.kcal,
        "",
        "",
        "",
      ]),
      ...state.weights.map((x) => [
        "體重",
        x.date,
        "體重",
        x.value,
        "",
        "",
        "",
        "",
      ]),
    ];
    const csv =
      "\uFEFF" +
      rows
        .map((row) =>
          row
            .map((value) => `"${String(value).replaceAll('"', '""')}"`)
            .join(","),
        )
        .join("\n");
    downloadBlob(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
      `真藍瘦-健康紀錄-${today}.csv`,
    );
    notify("健康紀錄已匯出");
  };
  const exportBackup = () => {
    const backup = JSON.stringify(createBackupPayload(state), null, 2);
    downloadBlob(
      new Blob([backup], { type: "application/json;charset=utf-8" }),
      `真藍瘦-完整備份-${today}.json`,
    );
    notify("完整備份已下載");
  };
  const restoreBackup = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      notify("備份檔超過 5MB，請確認是否選對檔案。", 5000);
      return;
    }
    try {
      const restored = restoreBackupText(await file.text());
      setState(restored);
      setDataOpen(false);
      notify("備份已還原，原有資料已由備份內容取代。", 4000);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "備份檔無法讀取。",
        5000,
      );
    }
  };
  const deleteAllUserData = () => {
    try {
      const keys = Array.from({ length: localStorage.length }, (_, index) =>
        localStorage.key(index),
      ).filter((key): key is string => Boolean(key));
      keys.forEach((key) => {
        if (key.startsWith("trueblue-") || key.startsWith("eat-right-"))
          localStorage.removeItem(key);
      });
    } catch {
      // 即使瀏覽器封鎖儲存空間，仍清除目前工作階段的狀態。
    }
    deliveredReminderRef.current.clear();
    setState(normalizeAppState({}));
    setTheme("light");
    setSelectedDate(today);
    setDataOpen(false);
    setProfileOpen(true);
    notify("所有個人紀錄已刪除。", 4000);
  };
  const toggleNotifications = async () => {
    const enabled = !state.reminders.notificationsEnabled;
    let permission: NotificationPermission | "unsupported" = "unsupported";
    if ("Notification" in window) {
      permission = Notification.permission;
      if (enabled && permission === "default") {
        try {
          permission = await Notification.requestPermission();
        } catch {
          permission = "denied";
        }
      }
    }
    setState((s) => ({
      ...s,
      reminders: { ...s.reminders, notificationsEnabled: enabled },
    }));
    notify(
      !enabled
        ? "所有提醒通知已關閉"
        : permission === "granted"
          ? "提醒已開啟，系統通知也已授權。"
          : "提醒已開啟；瀏覽器未授權系統通知，仍會顯示 App 內提醒。",
      permission === "granted" ? 2300 : 4500,
    );
  };
  const toggleReminder = (kind: "meal" | "water") => {
    const enabled =
      kind === "meal"
        ? !state.reminders.enabled
        : !state.reminders.waterEnabled;
    setState((s) => ({
      ...s,
      reminders: {
        ...s.reminders,
        ...(kind === "meal" ? { enabled } : { waterEnabled: enabled }),
      },
    }));
    notify(
      enabled
        ? kind === "meal"
          ? "飲食紀錄提醒已開啟"
          : "喝水定時提醒已開啟"
        : kind === "meal"
          ? "飲食紀錄提醒已關閉"
          : "喝水定時提醒已關閉",
    );
  };
  const updateWater = (amount: number) =>
    setState((s) => ({
      ...s,
      water: {
        ...s.water,
        [logDate]: clamp((s.water[logDate] || 0) + amount, 0, 5000),
      },
    }));
  const updateSleep = (next: SleepLog) =>
    setState((s) => ({ ...s, sleep: { ...s.sleep, [logDate]: next } }));

  const saveDailyWeight = (date: string, value: number) => {
    if (!Number.isFinite(value) || value < 20 || value > 400) {
      notify("請輸入 20 至 400 kg 之間的體重");
      return;
    }
    setState((current) => {
      const next = upsertWeightLog(current.weights, date, value);
      return {
        ...current,
        profile: { ...current.profile, weight: next.latestWeight },
        weights: next.weights,
      };
    });
    notify(`${date === today ? "今日" : date.slice(5).replace("-", "/")}體重已更新`);
  };

  const startWeight = state.weights[0]?.value ?? state.profile.weight;
  const weightDelta = state.profile.weight - startWeight;
  const progress =
    state.profile.target === startWeight
      ? 100
      : clamp(
          ((state.profile.weight - startWeight) /
            (state.profile.target - startWeight)) *
            100,
          0,
          100,
        );
  const plan = useMemo(
    () =>
      buildMealPlan({
        targetCalories: totals.targetCalories,
        intakeCalories: totals.intake,
        proteinTarget: totals.proteinTarget,
        proteinIntake: totals.protein,
        exerciseCalories: totals.exercise,
        goalMode: state.profile.goalMode,
        date: logDate,
        seed: planSeed,
        preference: planPreference,
        loggedMeals: dayFoods.map((food) => food.meal || "其他"),
      }),
    [
      dayFoods,
      logDate,
      planPreference,
      planSeed,
      state.profile.goalMode,
      totals.exercise,
      totals.intake,
      totals.protein,
      totals.proteinTarget,
      totals.targetCalories,
    ],
  );
  const shiftDate = (amount: number) => {
    const d = dateFromKey(logDate);
    d.setDate(d.getDate() + amount);
    const next = dateKey(d);
    if (next <= today) {
      setSelectedDate(next);
      setCalendarMonth(next.slice(0, 7));
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <button
          className="brand"
          onClick={() => setTab("today")}
          aria-label="回到首頁"
        >
          <span className="brand-icon">
            <Logo />
          </span>
          <b>真藍瘦</b>
        </button>
        <nav aria-label="主要導覽">
          <button
            className={tab === "today" ? "active" : ""}
            onClick={() => setTab("today")}
          >
            紀錄
          </button>
          <button
            className={tab === "history" ? "active" : ""}
            onClick={() => setTab("history")}
          >
            趨勢報告
          </button>
        </nav>
        <div className="top-actions">
          <button className="export-button" onClick={() => setDataOpen(true)}>
            資料管理
          </button>
          <button className="pro-upgrade" onClick={() => setProOpen(true)}>
            <span>PRO</span> 升級
          </button>
          <button
            className="theme-toggle"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            aria-label="切換深淺色"
          >
            <ThemeIcon dark={theme === "dark"} />
          </button>
          <button
            className="profile-button"
            onClick={() => setProfileOpen(true)}
          >
            <UserIcon />
            <span>個人設定</span>
          </button>
        </div>
      </header>

      {tab === "today" ? (
        <>
          <section className="welcome">
            <div>
              <p>
                {new Intl.DateTimeFormat("zh-TW", {
                  month: "long",
                  day: "numeric",
                  weekday: "long",
                }).format(dateFromKey(logDate))}
              </p>
              <h1>
                {logDate === today
                  ? "今天也照顧好自己。"
                  : "補記這一天的生活。"}
              </h1>
              <button
                className="encouragement"
                onClick={() =>
                  setQuote(
                    (i) =>
                      (i +
                        1 +
                        Math.floor(
                          Math.random() * (ENCOURAGEMENTS.length - 1),
                        )) %
                      ENCOURAGEMENTS.length,
                  )
                }
              >
                <span>✦</span>
                {ENCOURAGEMENTS[quote]}
                <i>換一句</i>
              </button>
            </div>
            <div className="welcome-tools">
              <div className="date-nav">
                <button onClick={() => shiftDate(-1)} aria-label="前一天">
                  ‹
                </button>
                <button
                  className="calendar-toggle"
                  aria-expanded={calendarOpen}
                  aria-controls="daily-calendar"
                  onClick={() => {
                    if (!calendarOpen) setCalendarMonth(logDate.slice(0, 7));
                    setCalendarOpen((open) => !open);
                  }}
                >
                  <CalendarIcon />
                  <span>
                    {logDate === today
                      ? "今天"
                      : logDate.slice(5).replace("-", "/")}
                  </span>
                  <i>{calendarOpen ? "⌃" : "⌄"}</i>
                </button>
                <button
                  disabled={logDate === today}
                  onClick={() => shiftDate(1)}
                  aria-label="後一天"
                >
                  ›
                </button>
              </div>
              {calendarOpen && (
                <DailyCalendar
                  month={calendarMonth}
                  selectedDate={logDate}
                  today={today}
                  state={state}
                  onMonthChange={setCalendarMonth}
                  onSelectDate={(date) => {
                    setSelectedDate(date);
                    setCalendarMonth(date.slice(0, 7));
                  }}
                  onWeight={saveDailyWeight}
                />
              )}
              <div className="today-actions">
                <button
                  className="soft-button"
                  onClick={() => {
                    setCalendarMonth(logDate.slice(0, 7));
                    setCalendarOpen(true);
                  }}
                >
                  ＋ 每日體重
                </button>
                <button
                  className="soft-button"
                  onClick={() => setExerciseOpen(true)}
                >
                  ＋ 記錄運動
                </button>
                <button
                  className="primary-button"
                  onClick={() => openSmartFood("text")}
                >
                  ✦ 智慧記錄餐點
                </button>
              </div>
            </div>
          </section>
          <section className="metric-grid">
            <Metric
              title={`${dayLabel}攝取`}
              value={totals.intake}
              unit={`／ ${totals.targetCalories} kcal`}
              percent={(totals.intake / totals.targetCalories) * 100}
              tone="coral"
              note={`還可安排約 ${remaining} kcal`}
            />
            <Metric
              title="運動消耗"
              value={totals.exercise}
              unit="kcal"
              tone="blue"
              note={
                dayExercises.length
                  ? `${dayExercises.length} 筆運動紀錄`
                  : "尚未記錄運動"
              }
            />
            <Metric
              title={`${dayLabel}熱量差`}
              value={totals.balance}
              unit="kcal"
              tone={totals.balance <= 0 ? "green" : "amber"}
              signed
              note={
                totals.balance <= -900
                  ? "赤字偏高，記得補充營養"
                  : totals.balance <= 0
                    ? "目前仍在熱量赤字"
                    : "目前高於估算消耗"
              }
            />
            <Metric
              title="蛋白質"
              value={Math.round(totals.protein)}
              unit={`／ ${totals.proteinTarget} g`}
              percent={(totals.protein / totals.proteinTarget) * 100}
              tone="purple"
              note={`碳水 ${Math.round(totals.carbs)}g・脂肪 ${Math.round(totals.fat)}g`}
            />
          </section>

          <section className="dashboard-grid">
            <div className="main-column">
              <article className="card food-browser">
                <div className="section-title">
                  <div>
                    <p>
                      {CURATED_FOODS.length.toLocaleString()} 項常用食物・搜尋可查{" "}
                      {ALL_FOODS.length.toLocaleString()} 項資料
                    </p>
                    <h2>
                      {logDate === today ? "今天吃了什麼？" : "這天吃了什麼？"}
                    </h2>
                  </div>
                  <div className="section-actions">
                    <button
                      className="text-button"
                      onClick={() => openSmartFood("text")}
                    >
                      智慧辨識
                    </button>
                    <button
                      className="text-button"
                      onClick={() => setCustomOpen(true)}
                    >
                      手動新增
                    </button>
                  </div>
                </div>
                <div className="capture-tools" aria-label="自動取得食物資料">
                  <button onClick={() => openSmartFood("text")}>
                    <span>✦</span>
                    <b>一句話記錄</b>
                    <small>茶葉蛋2顆＋地瓜100g</small>
                  </button>
                  <button onClick={() => openSmartFood("barcode")}>
                    <span>▥</span>
                    <b>掃描條碼</b>
                    <small>自動查包裝食品</small>
                  </button>
                  <button onClick={() => openSmartFood("label")}>
                    <span>▤</span>
                    <b>拍營養標示</b>
                    <small>照片在裝置上辨識</small>
                  </button>
                </div>
                <div className="library-modes">
                  <button
                    className={foodMode === "browse" ? "active" : ""}
                    onClick={() => {
                      setFoodMode("browse");
                      setFoodFilter("全部");
                    }}
                  >
                    常用食物
                  </button>
                  <button
                    className={foodMode === "recent" ? "active" : ""}
                    onClick={() => {
                      setFoodMode("recent");
                      setFoodFilter("全部");
                    }}
                  >
                    最近吃過
                  </button>
                  <button
                    className={foodMode === "favorites" ? "active" : ""}
                    onClick={() => {
                      setFoodMode("favorites");
                      setFoodFilter("全部");
                    }}
                  >
                    我的收藏
                  </button>
                </div>
                <div className="search-wrap">
                  <span>⌕</span>
                  <input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      if (e.target.value) setFoodFilter("全部");
                    }}
                    placeholder="搜尋雞胸、地瓜、牛肉麵…"
                  />
                  {search && (
                    <button onClick={() => setSearch("")} aria-label="清除搜尋">
                      ×
                    </button>
                  )}
                </div>
                <div className="filters">
                  {FOOD_FILTERS.map((filter) => (
                    <button
                      key={filter.value}
                      className={foodFilter === filter.value ? "active" : ""}
                      onClick={() => setFoodFilter(filter.value)}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
                <p className="result-hint">
                  {search.trim()
                    ? `找到 ${matched.length} 項，顯示前 ${visibleFoods.length} 項`
                    : foodMode === "browse" && foodFilter === "全部"
                      ? `預設顯示 ${visibleFoods.length} 個實用分類；輸入關鍵字可搜尋完整資料庫`
                      : `顯示 ${visibleFoods.length} 項，輸入關鍵字可搜尋完整資料庫`}
                </p>
                <div className="food-grid">
                  {visibleFoods.map((food) => (
                    <div className="food-item" key={food.id}>
                      <button
                        className={`favorite ${state.favorites.includes(food.id) ? "active" : ""}`}
                        onClick={() => toggleFavorite(food.id)}
                        aria-label="收藏"
                      >
                        ☆
                      </button>
                      <button
                        className="food-main"
                        onClick={() => addFood(food)}
                      >
                        <div className={`food-symbol ${food.category}`}>
                          {food.name.slice(0, 1)}
                        </div>
                        <div>
                          <strong>{food.name}</strong>
                          <small>
                            {food.category}・{food.source}・
                            {food.servingLabel || "1份"}・蛋白質{" "}
                            {food.protein}g
                          </small>
                          <SourceBadge food={food} compact />
                        </div>
                        <b>
                          {food.kcal}
                          <small> kcal</small>
                        </b>
                        <i>＋</i>
                      </button>
                      <button
                        className="report-food"
                        onClick={() => setReporting(food)}
                      >
                        資料有誤？
                      </button>
                    </div>
                  ))}
                </div>
                {!visibleFoods.length && (
                  <div className="empty-state">
                    這裡還沒有資料，換個關鍵字或先收藏常吃餐點。
                  </div>
                )}
              </article>

              <article className="card combo-card">
                <div className="section-title">
                  <div>
                    <p>一鍵重複記錄</p>
                    <h2>我的食譜與常用組合</h2>
                  </div>
                  <div className="section-actions">
                    <button className="text-button" onClick={saveCombo}>
                      存為組合
                    </button>
                    <button
                      className="text-button"
                      onClick={() =>
                        dayFoods.length
                          ? setRecipeOpen(true)
                          : notify("請先加入食材或餐點")
                      }
                    >
                      建立食譜
                    </button>
                  </div>
                </div>
                {state.recipes.length || state.combos.length ? (
                  <div className="combo-list">
                    {state.recipes.map((recipe) => (
                      <div key={recipe.id}>
                        <span>
                          <b>食譜・{recipe.name}</b>
                          <small>{recipe.items.length} 項食材・保留份量</small>
                        </span>
                        <button onClick={() => addRecipe(recipe)}>
                          一鍵加入
                        </button>
                        <button
                          className="remove"
                          onClick={() =>
                            setState((s) => ({
                              ...s,
                              recipes: s.recipes.filter(
                                (x) => x.id !== recipe.id,
                              ),
                            }))
                          }
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {state.combos.map((c) => (
                      <div key={c.id}>
                        <span>
                          <b>{c.name}</b>
                          <small>{c.foodIds.length} 項餐點</small>
                        </span>
                        <button onClick={() => addCombo(c)}>一鍵加入</button>
                        <button
                          className="remove"
                          onClick={() =>
                            setState((s) => ({
                              ...s,
                              combos: s.combos.filter((x) => x.id !== c.id),
                            }))
                          }
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-mini">
                    先加入茶葉蛋、地瓜或其他食材，再建立自己的食譜。
                  </div>
                )}
              </article>

              <article className="card plan-card">
                <div className="section-title">
                  <div>
                    <p>不使用 AI・零額外成本</p>
                    <h2>今日菜單參考建議</h2>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setPlanSeed((x) => x + 1)}
                  >
                    換一組
                  </button>
                </div>
                <div
                  className="plan-preferences"
                  role="group"
                  aria-label="選擇菜單情境"
                >
                  {MEAL_PLAN_PREFERENCES.map((option) => (
                    <button
                      key={option.id}
                      className={planPreference === option.id ? "active" : ""}
                      aria-pressed={planPreference === option.id}
                      onClick={() => {
                        setPlanPreference(option.id);
                        setPlanSeed(0);
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="plan-explanation" aria-live="polite">
                  <div>
                    <b>{plan.title}</b>
                    <span>{plan.reason}</span>
                  </div>
                  <div className="plan-tags">
                    {plan.tags.map((tag) => (
                      <small key={tag}>{tag}</small>
                    ))}
                  </div>
                </div>
                <div className="plan-grid">
                  {plan.items.map((item) => (
                    <button
                      key={`${item.meal}-${item.food.id}`}
                      onClick={() => addFood(item.food, item.meal)}
                    >
                      <span>{item.meal}</span>
                      <strong>{item.food.name}</strong>
                      <small>
                        {item.food.kcal} kcal・蛋白質 {item.food.protein}g
                      </small>
                      <i>＋ 加入</i>
                    </button>
                  ))}
                </div>
                <p className="plan-total">
                  本組約 {plan.totalKcal} kcal・蛋白質 {plan.totalProtein}
                  g；從 {plan.candidateCount} 項合適餐點輪替組合。請依實際份量與飽足感調整。
                </p>
              </article>
            </div>

            <aside className="side-column">
              <article className="card daily-log">
                <div className="section-title">
                  <div>
                    <p>{logDate === today ? "今日動態" : "補登紀錄"}</p>
                    <h2>紀錄明細</h2>
                  </div>
                  <span>{dayFoods.length + dayExercises.length} 筆</span>
                </div>
                {!dayFoods.length && !dayExercises.length ? (
                  <div className="empty-log">
                    <b>這天還沒有紀錄</b>
                    <span>從餐點資料庫加入第一餐。</span>
                  </div>
                ) : (
                  <div className="log-list">
                    {dayFoods.map((x) => (
                      <LogItem
                        key={x.logId}
                        kind="food"
                        name={x.name}
                        detail={`${x.meal || "其他"}・${x.servings} 份・蛋白質 ${Math.round(x.protein * x.servings)}g`}
                        kcal={Math.round(x.kcal * x.servings)}
                        onEdit={() => setEditing(x)}
                        onRemove={() =>
                          setState((s) => ({
                            ...s,
                            foods: s.foods.filter((f) => f.logId !== x.logId),
                          }))
                        }
                      />
                    ))}
                    {dayExercises.map((x) => (
                      <LogItem
                        key={x.logId}
                        kind="exercise"
                        name={x.name}
                        detail={`${x.minutes} 分鐘`}
                        kcal={x.kcal}
                        onRemove={() =>
                          setState((s) => ({
                            ...s,
                            exercises: s.exercises.filter(
                              (e) => e.logId !== x.logId,
                            ),
                          }))
                        }
                      />
                    ))}
                  </div>
                )}
              </article>
              <article className="card wellness-card">
                <div className="section-title">
                  <div>
                    <p>恢復狀態</p>
                    <h2>飲水與睡眠</h2>
                  </div>
                </div>
                <div className="water-row">
                  <span>水分</span>
                  <b>
                    {water.toLocaleString()} /{" "}
                    {dailyWaterTarget.toLocaleString()} ml
                  </b>
                </div>
                <div className="water-progress">
                  <i
                    style={{
                      width: `${clamp((water / dailyWaterTarget) * 100, 0, 100)}%`,
                    }}
                  />
                </div>
                <div className="quick-buttons">
                  <button onClick={() => updateWater(250)}>＋250 ml</button>
                  <button onClick={() => updateWater(500)}>＋500 ml</button>
                  <button onClick={() => updateWater(-250)}>復原</button>
                </div>
                <p className="water-note">
                  依目前體重估算，可在炎熱或大量運動日自行增加。
                </p>
                <div className="sleep-row">
                  <span>睡眠</span>
                  <div>
                    <button
                      onClick={() =>
                        updateSleep({
                          ...sleep,
                          hours: clamp(sleep.hours - 0.5, 0, 14),
                        })
                      }
                    >
                      −
                    </button>
                    <b>{sleep.hours} 小時</b>
                    <button
                      onClick={() =>
                        updateSleep({
                          ...sleep,
                          hours: clamp(sleep.hours + 0.5, 0, 14),
                        })
                      }
                    >
                      ＋
                    </button>
                  </div>
                </div>
                <select
                  value={sleep.quality}
                  onChange={(e) =>
                    updateSleep({
                      ...sleep,
                      quality: e.target.value as SleepLog["quality"],
                    })
                  }
                >
                  <option>普通</option>
                  <option>良好</option>
                  <option>很棒</option>
                </select>
              </article>
              <article className="card nutrient-card">
                <div className="section-title">
                  <div>
                    <p>進階營養</p>
                    <h2>鈉、糖與纖維</h2>
                  </div>
                  <span>估算</span>
                </div>
                <NutrientBar
                  label="鈉"
                  value={Math.round(totals.sodium)}
                  target={2300}
                  unit="mg"
                  warn
                />
                <NutrientBar
                  label="糖"
                  value={Math.round(totals.sugar)}
                  target={50}
                  unit="g"
                  warn
                />
                <NutrientBar
                  label="膳食纖維"
                  value={Math.round(totals.fiber)}
                  target={25}
                  unit="g"
                />
              </article>
              <article className="card reminder-card water-reminder-card">
                <div className="section-title">
                  <div>
                    <p>定時補充水分</p>
                    <h2>喝水定時提醒</h2>
                  </div>
                  <button
                    className={`switch ${state.reminders.waterEnabled ? "on" : ""}`}
                    onClick={() => toggleReminder("water")}
                    disabled={!state.reminders.notificationsEnabled}
                    aria-label="切換喝水定時提醒"
                    role="switch"
                    aria-checked={state.reminders.waterEnabled}
                  >
                    <i />
                  </button>
                </div>
                <div className="notification-master">
                  <span>
                    <b>提醒通知總開關</b>
                    <small>關閉後，飲食與喝水都不會跳出任何提醒。</small>
                  </span>
                  <button
                    className={`switch ${state.reminders.notificationsEnabled ? "on" : ""}`}
                    onClick={toggleNotifications}
                    aria-label="切換提醒通知總開關"
                    role="switch"
                    aria-checked={state.reminders.notificationsEnabled}
                  >
                    <i />
                  </button>
                </div>
                <div className="water-schedule">
                  <label>
                    開始時間
                    <input
                      type="time"
                      value={state.reminders.waterStart}
                      onChange={(e) =>
                        setState((s) => ({
                          ...s,
                          reminders: {
                            ...s.reminders,
                            waterStart: e.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                  <label>
                    結束時間
                    <input
                      type="time"
                      value={state.reminders.waterEnd}
                      onChange={(e) =>
                        setState((s) => ({
                          ...s,
                          reminders: {
                            ...s.reminders,
                            waterEnd: e.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="span-2">
                    提醒間隔
                    <select
                      value={state.reminders.waterInterval}
                      onChange={(e) =>
                        setState((s) => ({
                          ...s,
                          reminders: {
                            ...s.reminders,
                            waterInterval: Number(e.target.value),
                          },
                        }))
                      }
                    >
                      <option value="30">每 30 分鐘</option>
                      <option value="60">每 1 小時</option>
                      <option value="90">每 1.5 小時</option>
                      <option value="120">每 2 小時</option>
                      <option value="180">每 3 小時</option>
                    </select>
                  </label>
                </div>
                {state.reminders.waterStart > state.reminders.waterEnd ? (
                  <p className="reminder-warning">
                    結束時間需晚於開始時間，請重新設定。
                  </p>
                ) : (
                  <p className="reminder-summary">
                    {state.reminders.waterEnabled &&
                    state.reminders.notificationsEnabled
                      ? `${state.reminders.waterStart}～${state.reminders.waterEnd}，每 ${state.reminders.waterInterval} 分鐘提醒一次。`
                      : "目前不會發送喝水提醒；開啟總開關與喝水提醒後才會生效。"}
                  </p>
                )}
                <p className="reminder-note">
                  目前網頁版需保持開啟才能定時檢查；未來上架手機 App
                  時會改用系統排程通知。
                </p>
              </article>
              <article className="card reminder-card meal-reminder-card">
                <div className="section-title">
                  <div>
                    <p>避免漏記餐點</p>
                    <h2>飲食紀錄提醒</h2>
                  </div>
                  <button
                    className={`switch ${state.reminders.enabled ? "on" : ""}`}
                    onClick={() => toggleReminder("meal")}
                    disabled={!state.reminders.notificationsEnabled}
                    aria-label="切換飲食紀錄提醒"
                    role="switch"
                    aria-checked={state.reminders.enabled}
                  >
                    <i />
                  </button>
                </div>
                <div className="reminder-times meal-times">
                  <label>
                    早餐
                    <input
                      type="time"
                      value={state.reminders.breakfast}
                      onChange={(e) =>
                        setState((s) => ({
                          ...s,
                          reminders: {
                            ...s.reminders,
                            breakfast: e.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                  <label>
                    午餐
                    <input
                      type="time"
                      value={state.reminders.lunch}
                      onChange={(e) =>
                        setState((s) => ({
                          ...s,
                          reminders: { ...s.reminders, lunch: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="span-2">
                    晚餐
                    <input
                      type="time"
                      value={state.reminders.dinner}
                      onChange={(e) =>
                        setState((s) => ({
                          ...s,
                          reminders: {
                            ...s.reminders,
                            dinner: e.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                </div>
                <p className="reminder-note">
                  提醒通知總開關關閉時，只保留時間設定，不會跳出通知。
                </p>
              </article>
              <article className="card insight-card">
                <span>今日提醒</span>
                <h3>
                  {totals.exercise > 0
                    ? "運動後，恢復也很重要。"
                    : "今天還有活動一下嗎？"}
                </h3>
                <p>
                  {totals.exercise > 0
                    ? `蛋白質還差約 ${Math.max(0, totals.proteinTarget - Math.round(totals.protein))}g，今晚睡眠 ${sleep.hours} 小時。`
                    : "散步、游泳或伸展都能記錄，從容易持續的活動開始。"}
                </p>
                <button onClick={() => setExerciseOpen(true)}>記錄運動</button>
              </article>
            </aside>
          </section>
        </>
      ) : (
        <History
          state={state}
          progress={progress}
          weightDelta={weightDelta}
          onExport={exportData}
          onWeight={(value) => saveDailyWeight(today, value)}
        />
      )}

      <footer>
        <span>
          熱量、營養與運動消耗均為估算值，不能取代醫師或營養師建議。
        </span>
        <nav aria-label="法律與資料說明">
          <Link href="/privacy">隱私權</Link>
          <Link href="/terms">使用條款</Link>
          <Link href="/methodology">計算方法</Link>
          <button onClick={() => setDataOpen(true)}>資料管理</button>
          <span>v0.12.0</span>
        </nav>
      </footer>
      <div
        className={`toast ${toast ? "show" : ""}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {toast}
      </div>
      {profileOpen && (
        <ProfileModal
          profile={state.profile}
          onClose={() => setProfileOpen(false)}
          onSave={(profile) => {
            setState((s) => ({ ...s, profile }));
            setProfileOpen(false);
            notify("個人資料已儲存");
          }}
        />
      )}
      {customOpen && (
        <CustomFoodModal
          onClose={() => setCustomOpen(false)}
          onSave={(food) => {
            addFood(food);
            setCustomOpen(false);
          }}
        />
      )}
      {smartOpen && (
        <SmartFoodModal
          initialMode={smartMode}
          foods={ALL_FOODS}
          onClose={() => setSmartOpen(false)}
          onAddItems={addParsedFoods}
          onAddFood={(food) => {
            addFood(food);
            setSmartOpen(false);
          }}
          onManual={() => {
            setSmartOpen(false);
            setCustomOpen(true);
          }}
        />
      )}
      {exerciseOpen && (
        <ExerciseModal
          weight={state.profile.weight}
          onClose={() => setExerciseOpen(false)}
          onSave={(log) => {
            setState((s) => ({
              ...s,
              exercises: [
                ...s.exercises,
                { ...log, logId: uid(), date: logDate },
              ],
            }));
            setExerciseOpen(false);
            notify(`估算消耗 ${log.kcal} kcal`);
          }}
        />
      )}
      {editing && (
        <EditFoodModal
          log={editing}
          onClose={() => setEditing(null)}
          onSave={(next) => {
            setState((s) => ({
              ...s,
              foods: s.foods.map((x) => (x.logId === next.logId ? next : x)),
            }));
            setEditing(null);
            notify("餐點已更新");
          }}
        />
      )}
      {recipeOpen && (
        <RecipeModal
          items={dayFoods}
          onClose={() => setRecipeOpen(false)}
          onSave={saveRecipe}
        />
      )}
      {reporting && (
        <ReportModal
          food={reporting}
          onClose={() => setReporting(null)}
          onSave={saveReport}
        />
      )}
      {dataOpen && (
        <DataManagementModal
          state={state}
          onClose={() => setDataOpen(false)}
          onExportCsv={exportData}
          onExportBackup={exportBackup}
          onRestore={restoreBackup}
          onDelete={deleteAllUserData}
        />
      )}
      {proOpen && (
        <Modal title="真藍瘦 PRO" onClose={() => setProOpen(false)}>
          <div className="pro-content">
            <span className="pro-pill">規劃中的付費功能</span>
            <div className="pro-features">
              <b>AI 拍照辨識整盤料理與份量</b>
              <b>辨識模糊描述並主動追問份量</b>
              <b>外送與餐廳菜單智慧挑選</b>
              <b>依目標產生每週調整建議</b>
            </div>
            <p>
              目前不會實際扣款。免費版永久保留完整食物搜尋、條碼查詢、營養標示辨識、文字份量解析、運動與體重紀錄；只有需要
              AI 推理的模糊餐點才列入 PRO 額度。
            </p>
            <button
              className="primary-button"
              onClick={() => {
                setProOpen(false);
                notify("PRO 尚未開放收費，已為你登記興趣");
              }}
            >
              我對 PRO 有興趣
            </button>
            <button className="soft-button" onClick={() => setProOpen(false)}>
              繼續使用免費版
            </button>
          </div>
        </Modal>
      )}
      <button className="pro-fab" onClick={() => setProOpen(true)}>
        PRO
      </button>
    </main>
  );
}

function Metric({
  title,
  value,
  unit,
  percent,
  tone,
  note,
  signed,
}: {
  title: string;
  value: number;
  unit: string;
  percent?: number;
  tone: string;
  note: string;
  signed?: boolean;
}) {
  return (
    <article className={`metric ${tone}`}>
      <span>{title}</span>
      <div>
        <strong>
          {signed && value > 0 ? "+" : ""}
          {Math.round(value).toLocaleString()}
        </strong>
        <small>{unit}</small>
      </div>
      {percent !== undefined && (
        <div className="progress">
          <i style={{ width: `${clamp(percent, 0, 100)}%` }} />
        </div>
      )}
      <p>{note}</p>
    </article>
  );
}
function NutrientBar({
  label,
  value,
  target,
  unit,
  warn,
}: {
  label: string;
  value: number;
  target: number;
  unit: string;
  warn?: boolean;
}) {
  const percent = clamp((value / target) * 100, 0, 100);
  return (
    <div className={`nutrient-row ${warn && value > target ? "over" : ""}`}>
      <div>
        <span>{label}</span>
        <b>
          {value.toLocaleString()} / {target.toLocaleString()} {unit}
        </b>
      </div>
      <div>
        <i style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
function LogItem({
  kind,
  name,
  detail,
  kcal,
  onEdit,
  onRemove,
}: {
  kind: "food" | "exercise";
  name: string;
  detail: string;
  kcal: number;
  onEdit?: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="log-item">
      <span className={kind} />
      <div>
        <strong>{name}</strong>
        <small>{detail}</small>
      </div>
      <b className={kind}>
        {kind === "exercise" ? "−" : ""}
        {kcal} kcal
      </b>
      {onEdit && (
        <button onClick={onEdit} aria-label="編輯">
          編
        </button>
      )}
      <button onClick={onRemove} aria-label="刪除">
        ×
      </button>
    </div>
  );
}
function Modal({
  title,
  onClose,
  children,
  className = "",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const titleId = useId();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.currentTarget === e.target) onClose();
      }}
    >
      <section
        className={`modal ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <button
          className="modal-close"
          onClick={onClose}
          aria-label="關閉視窗"
          autoFocus
        >
          ×
        </button>
        <p>設定</p>
        <h2 id={titleId}>{title}</h2>
        {children}
      </section>
    </div>
  );
}

function DataManagementModal({
  state,
  onClose,
  onExportCsv,
  onExportBackup,
  onRestore,
  onDelete,
}: {
  state: AppState;
  onClose: () => void;
  onExportCsv: () => void;
  onExportBackup: () => void;
  onRestore: (file: File) => Promise<void>;
  onDelete: () => void;
}) {
  const [deleteText, setDeleteText] = useState("");
  const recordCount =
    state.foods.length + state.exercises.length + state.weights.length;
  return (
    <Modal title="資料與隱私管理" onClose={onClose}>
      <div className="data-summary">
        <span>此裝置共有</span>
        <strong>{recordCount.toLocaleString()} 筆健康紀錄</strong>
        <p>
          個人資料預設只存在這台裝置的瀏覽器中。條碼查詢只會把商品條碼送至
          Open Food Facts；營養標示照片在裝置上辨識。
        </p>
      </div>
      <div className="data-actions-grid">
        <button className="soft-button" onClick={onExportCsv}>
          <b>匯出 CSV</b>
          <small>適合試算表與紀錄檢視</small>
        </button>
        <button className="soft-button" onClick={onExportBackup}>
          <b>下載完整備份</b>
          <small>包含設定、飲食、運動與體重</small>
        </button>
        <label className="soft-button backup-import">
          <b>還原完整備份</b>
          <small>會以備份內容取代目前資料</small>
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onRestore(file);
              event.currentTarget.value = "";
            }}
          />
        </label>
      </div>
      <div className="legal-links">
        <Link href="/privacy">閱讀隱私權政策</Link>
        <Link href="/methodology">查看熱量與營養計算方法</Link>
      </div>
      <div className="danger-zone">
        <b>永久刪除這台裝置上的資料</b>
        <p>此動作無法復原。建議先下載完整備份，再輸入「刪除」確認。</p>
        <div>
          <input
            value={deleteText}
            onChange={(event) => setDeleteText(event.target.value)}
            placeholder="輸入：刪除"
          />
          <button disabled={deleteText !== "刪除"} onClick={onDelete}>
            刪除全部資料
          </button>
        </div>
      </div>
    </Modal>
  );
}

function SourceBadge({
  food,
  compact = false,
}: {
  food: Food;
  compact?: boolean;
}) {
  const meta = getFoodSourceMeta(food);
  return (
    <span
      className={`source-badge ${meta.tone} ${compact ? "compact" : ""}`}
      title={meta.detail}
    >
      {meta.label}
    </span>
  );
}

function SmartFoodModal({
  initialMode,
  foods,
  onClose,
  onAddItems,
  onAddFood,
  onManual,
}: {
  initialMode: SmartFoodMode;
  foods: Food[];
  onClose: () => void;
  onAddItems: (items: ParsedFoodItem[]) => void;
  onAddFood: (food: Food) => void;
  onManual: () => void;
}) {
  const [mode, setMode] = useState<SmartFoodMode>(initialMode);
  const [text, setText] = useState("茶葉蛋2顆＋烤地瓜100g");
  const parsed = useMemo(() => parseFoodText(text, foods), [text, foods]);
  const total = parsed.matched.reduce(
    (sum, item) => sum + item.food.kcal * item.servings,
    0,
  );

  return (
    <Modal title="智慧取得食物資料" onClose={onClose}>
      <div className="smart-tabs">
        <button
          className={mode === "text" ? "active" : ""}
          onClick={() => setMode("text")}
        >
          一句話
        </button>
        <button
          className={mode === "barcode" ? "active" : ""}
          onClick={() => setMode("barcode")}
        >
          掃條碼
        </button>
        <button
          className={mode === "label" ? "active" : ""}
          onClick={() => setMode("label")}
        >
          營養標示
        </button>
      </div>

      {mode === "text" && (
        <div className="smart-panel">
          <label className="textarea-label">
            輸入食物與份量
            <textarea
              autoFocus
              rows={3}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="例如：茶葉蛋2顆＋無糖豆漿1瓶＋地瓜100g"
            />
          </label>
          <p className="helper">
            一般食物先由本地資料庫解析，不會使用付費
            AI。請用「＋」或逗號分隔多項食物。
          </p>
          <div className="resolver-results">
            {parsed.matched.map((item, index) => (
              <div key={`${item.raw}-${index}`}>
                <span>
                  <b>{item.food.name}</b>
                  <small>
                    {item.quantityLabel}・
                    {Math.round(item.food.protein * item.servings)}g 蛋白質
                  </small>
                  <SourceBadge food={item.food} />
                </span>
                <strong>
                  {Math.round(item.food.kcal * item.servings)} kcal
                </strong>
              </div>
            ))}
          </div>
          {!!parsed.unmatched.length && (
            <p className="resolver-warning">
              尚未辨識：{parsed.unmatched.join("、")}
              。可換名稱，或改用手動新增。
            </p>
          )}
          {!!parsed.matched.length && (
            <div className="resolver-total">
              <span>預估合計</span>
              <b>{Math.round(total)} kcal</b>
            </div>
          )}
          <div className="modal-actions">
            <button className="soft-button" onClick={onManual}>
              改用手動新增
            </button>
            <button
              className="primary-button"
              disabled={!parsed.matched.length}
              onClick={() => onAddItems(parsed.matched)}
            >
              確認加入 {parsed.matched.length || ""} 項
            </button>
          </div>
        </div>
      )}

      {mode === "barcode" && (
        <BarcodePanel onAddFood={onAddFood} onManual={onManual} />
      )}
      {mode === "label" && <NutritionLabelPanel onAddFood={onAddFood} />}
    </Modal>
  );
}

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
};

function BarcodePanel({
  onAddFood,
  onManual,
}: {
  onAddFood: (food: Food) => void;
  onManual: () => void;
}) {
  const [barcode, setBarcode] = useState("");
  const [result, setResult] = useState<Food | null>(null);
  const [status, setStatus] = useState("");
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const detectingRef = useRef(false);

  const stopCamera = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  };

  useEffect(
    () => () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const lookup = async (value = barcode) => {
    const code = value.replace(/\D/g, "");
    if (code.length < 8) return setStatus("請輸入至少 8 碼的商品條碼");
    setBarcode(code);
    setResult(null);
    setStatus("正在查詢條碼資料…");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    try {
      let cache: Record<string, { food: Food; savedAt: number }> = {};
      const cachedText = safeStorageGet(BARCODE_CACHE_KEY);
      if (cachedText) {
        try {
          const parsed = JSON.parse(cachedText) as unknown;
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
            cache = parsed as Record<string, { food: Food; savedAt: number }>;
        } catch {
          try {
            localStorage.removeItem(BARCODE_CACHE_KEY);
          } catch {
            // 快取損壞不影響線上查詢。
          }
        }
      }
      if (cache[code]?.food) {
        setResult(cache[code].food);
        setStatus("已從裝置快取找到，不需要再次連線");
        return;
      }
      const fields = [
        "code",
        "product_name",
        "brands",
        "serving_quantity",
        "serving_size",
        "nutriments",
      ].join(",");
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}?fields=${fields}`,
        { signal: controller.signal },
      );
      if (!response.ok) throw new Error("network");
      const data = (await response.json()) as {
        status?: number;
        product?: Parameters<typeof foodFromOpenFoodFacts>[1];
      };
      const food =
        data.status === 1 && data.product
          ? foodFromOpenFoodFacts(code, data.product)
          : null;
      if (!food) {
        setStatus("資料庫找不到完整營養資料，請拍營養標示或手動新增");
        return;
      }
      const entries = Object.entries({
        ...cache,
        [code]: { food, savedAt: Date.now() },
      }).slice(-200);
      safeStorageSet(
        BARCODE_CACHE_KEY,
        JSON.stringify(Object.fromEntries(entries)),
      );
      setResult(food);
      setStatus("已取得資料，加入前請核對包裝標示");
    } catch {
      setStatus("條碼服務暫時無法連線，請改拍營養標示或手動新增");
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const startCamera = async () => {
    const Detector = (
      window as typeof window & { BarcodeDetector?: BarcodeDetectorConstructor }
    ).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setStatus("這個瀏覽器不支援即時掃描，仍可手動輸入條碼");
      return;
    }
    try {
      setStatus("正在開啟相機…");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setScanning(true);
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      const detector = new Detector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e"],
      });
      setStatus("把條碼放進畫面中央");
      timerRef.current = window.setInterval(async () => {
        if (detectingRef.current || video.readyState < 2) return;
        detectingRef.current = true;
        try {
          const codes = await detector.detect(video);
          if (codes[0]?.rawValue) {
            stopCamera();
            void lookup(codes[0].rawValue);
          }
        } catch {
          // 某些裝置會短暫無法辨識單一影格，下一次掃描會繼續。
        } finally {
          detectingRef.current = false;
        }
      }, 550);
    } catch {
      stopCamera();
      setStatus("無法使用相機，請確認權限或直接輸入條碼");
    }
  };

  return (
    <div className="smart-panel">
      <div className={`barcode-camera ${scanning ? "active" : ""}`}>
        <video ref={videoRef} playsInline muted />
        {!scanning && <span>▥</span>}
        {scanning && <i />}
      </div>
      <div className="barcode-entry">
        <input
          inputMode="numeric"
          value={barcode}
          onChange={(event) =>
            setBarcode(event.target.value.replace(/\D/g, ""))
          }
          placeholder="輸入包裝上的條碼數字"
        />
        <button
          className="soft-button"
          onClick={() => (scanning ? stopCamera() : void startCamera())}
        >
          {scanning ? "停止相機" : "開啟相機"}
        </button>
        <button className="primary-button" onClick={() => void lookup()}>
          查詢
        </button>
      </div>
      {status && <p className="scan-status">{status}</p>}
      {result && (
        <div className="scan-result">
          <span>
            <b>{result.name}</b>
            <small>
              {result.source}・{result.servingLabel}
            </small>
            <SourceBadge food={result} />
          </span>
          <strong>{result.kcal} kcal</strong>
          <button
            className="primary-button full"
            onClick={() => onAddFood(result)}
          >
            確認並加入今日紀錄
          </button>
        </div>
      )}
      {!result && status.includes("找不到") && (
        <button className="soft-button full" onClick={onManual}>
          改用手動新增
        </button>
      )}
      <p className="privacy-note">
        條碼結果會儲存在這台裝置；相同商品下次不再連外查詢。
      </p>
    </div>
  );
}

function NutritionLabelPanel({
  onAddFood,
}: {
  onAddFood: (food: Food) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("拍攝整張營養標示，避免反光與傾斜。");
  const [rawText, setRawText] = useState("");
  const [food, setFood] = useState<Food | null>(null);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const selectFile = (next: File | null) => {
    setFile(next);
    setFood(null);
    setRawText("");
    setProgress(0);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(next ? URL.createObjectURL(next) : "");
    setStatus(next ? "照片已選擇，按下辨識開始讀取。" : "請選擇營養標示照片。");
  };

  const applyText = (text: string) => {
    const parsed = parseNutritionLabel(text);
    setFood(parsed);
    setStatus(
      parsed.kcal > 0
        ? "辨識完成，請核對每份數值。"
        : "未讀到熱量，請在下方修正數值。",
    );
  };

  const recognize = async () => {
    if (!file) return setStatus("請先拍攝或選擇一張營養標示照片");
    setStatus("首次辨識會下載文字模型，之後即可重複使用。");
    setProgress(1);
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker(["chi_tra", "eng"], 1, {
        logger: (message) => {
          if (message.status === "recognizing text")
            setProgress(Math.round((message.progress || 0) * 100));
        },
      });
      try {
        const recognized = await worker.recognize(file);
        const text = recognized.data.text.trim();
        setRawText(text);
        applyText(text);
        setProgress(100);
      } finally {
        await worker.terminate();
      }
    } catch {
      setStatus(
        "自動辨識失敗，可把標示文字貼到下方後重新解析，或直接手動填寫。",
      );
      setFood(parseNutritionLabel(""));
      setProgress(0);
    }
  };

  return (
    <div className="smart-panel">
      <label className={`label-drop ${preview ? "has-image" : ""}`}>
        {preview ? (
          // 使用本機 blob 預覽，不能交給 Next Image 的遠端最佳化流程。
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="待辨識的營養標示" />
        ) : (
          <>
            <span>▤</span>
            <b>拍攝或選擇營養標示</b>
            <small>支援 JPG、PNG、HEIC（依瀏覽器）</small>
          </>
        )}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => selectFile(event.target.files?.[0] || null)}
        />
      </label>
      <button
        className="primary-button full"
        disabled={!file || (progress > 0 && progress < 100)}
        onClick={() => void recognize()}
      >
        {progress > 0 && progress < 100
          ? `辨識中 ${progress}%`
          : "開始辨識營養標示"}
      </button>
      <p className="scan-status">{status}</p>
      {(rawText || food) && (
        <details className="ocr-text">
          <summary>查看或修正辨識文字</summary>
          <textarea
            rows={5}
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
          />
          <button className="soft-button" onClick={() => applyText(rawText)}>
            重新解析文字
          </button>
        </details>
      )}
      {food && (
        <div className="label-confirm">
          <div className="source-heading">
            <SourceBadge food={food} />
            <span>加入前必須確認「每份」與「每100克」是否看反。</span>
          </div>
          <NutritionFields food={food} setFood={setFood} />
          <button
            className="primary-button full"
            disabled={!food.name.trim() || food.kcal <= 0}
            onClick={() => onAddFood({ ...food, id: uid() })}
          >
            數值正確，加入今日紀錄
          </button>
        </div>
      )}
      <p className="privacy-note">
        照片只在目前裝置進行文字辨識，不會上傳到真藍瘦伺服器。
      </p>
    </div>
  );
}

function ProfileModal({
  profile,
  onClose,
  onSave,
}: {
  profile: Profile;
  onClose: () => void;
  onSave: (p: Profile) => void;
}) {
  const [draft, setDraft] = useState(profile);
  const estimate = calculateEnergyTotals(draft, [], []);
  const bmi = draft.weight / Math.max(1, (draft.height / 100) ** 2);
  const mismatch =
    (draft.goalMode === "cut" && draft.target >= draft.weight) ||
    (draft.goalMode === "gain" && draft.target <= draft.weight);
  const risky = draft.age < 18 || (bmi < 18.5 && draft.goalMode === "cut");
  const setWeightPart = (
    field: "weight" | "target",
    part: "whole" | "tenth",
    value: number,
  ) => {
    const current = splitProfileWeight(draft[field]);
    const next = composeProfileWeight(
      part === "whole" ? value : current.whole,
      part === "tenth" ? value : current.tenth,
    );
    setDraft({ ...draft, [field]: next });
  };
  const weightParts = splitProfileWeight(draft.weight);
  const targetParts = splitProfileWeight(draft.target);
  const valid =
    draft.name.trim() &&
    draft.age >= 18 &&
    draft.age <= 100 &&
    draft.height >= 120 &&
    draft.height <= 230 &&
    draft.weight >= 20 &&
    draft.weight <= 400 &&
    draft.target >= 20 &&
    draft.target <= 400;
  return (
    <Modal
      title="個人資料與目標"
      onClose={onClose}
      className="profile-modal"
    >
      <div className="goal-selector">
        {(["cut", "maintain", "gain"] as GoalMode[]).map((m) => (
          <button
            key={m}
            className={draft.goalMode === m ? "active" : ""}
            onClick={() => setDraft({ ...draft, goalMode: m })}
          >
            {m === "cut" ? "減脂" : m === "maintain" ? "維持" : "增肌"}
          </button>
        ))}
      </div>
      <label className="mobile-goal-field">
        目標方向
        <select
          value={draft.goalMode}
          onChange={(event) =>
            setDraft({ ...draft, goalMode: event.target.value as GoalMode })
          }
        >
          <option value="cut">減脂</option>
          <option value="maintain">維持</option>
          <option value="gain">增肌</option>
        </select>
      </label>
      <div className="form-grid">
        <label>
          顯示名稱
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <label>
          生理性別
          <select
            value={draft.sex}
            onChange={(e) =>
              setDraft({ ...draft, sex: e.target.value as Profile["sex"] })
            }
          >
            <option value="male">男性</option>
            <option value="female">女性</option>
          </select>
        </label>
        <label>
          年齡
          <select
            value={draft.age}
            onChange={(e) =>
              setDraft({ ...draft, age: Number(e.target.value) })
            }
          >
            {PROFILE_AGE_OPTIONS.map((age) => (
              <option value={age} key={age}>
                {age} 歲
              </option>
            ))}
          </select>
        </label>
        <label>
          身高（cm）
          <select
            value={draft.height}
            onChange={(e) =>
              setDraft({ ...draft, height: Number(e.target.value) })
            }
          >
            {PROFILE_HEIGHT_OPTIONS.map((height) => (
              <option value={height} key={height}>
                {height} cm
              </option>
            ))}
          </select>
        </label>
        <label>
          目前體重（kg）
          <span className="weight-select-row">
            <select
              aria-label="目前體重公斤"
              value={weightParts.whole}
              onChange={(event) =>
                setWeightPart("weight", "whole", Number(event.target.value))
              }
            >
              {PROFILE_WEIGHT_WHOLE_OPTIONS.map((weight) => (
                <option value={weight} key={weight}>
                  {weight}
                </option>
              ))}
            </select>
            <select
              aria-label="目前體重小數"
              value={weightParts.tenth}
              onChange={(event) =>
                setWeightPart("weight", "tenth", Number(event.target.value))
              }
            >
              {PROFILE_WEIGHT_TENTH_OPTIONS.map((tenth) => (
                <option value={tenth} key={tenth}>
                  .{tenth}
                </option>
              ))}
            </select>
            <span>kg</span>
          </span>
        </label>
        <label>
          目標體重（kg）
          <span className="weight-select-row">
            <select
              aria-label="目標體重公斤"
              value={targetParts.whole}
              onChange={(event) =>
                setWeightPart("target", "whole", Number(event.target.value))
              }
            >
              {PROFILE_WEIGHT_WHOLE_OPTIONS.map((weight) => (
                <option value={weight} key={weight}>
                  {weight}
                </option>
              ))}
            </select>
            <select
              aria-label="目標體重小數"
              value={targetParts.tenth}
              onChange={(event) =>
                setWeightPart("target", "tenth", Number(event.target.value))
              }
            >
              {PROFILE_WEIGHT_TENTH_OPTIONS.map((tenth) => (
                <option value={tenth} key={tenth}>
                  .{tenth}
                </option>
              ))}
            </select>
            <span>kg</span>
          </span>
        </label>
        <label className="span-2">
          非運動日常活動
          <select
            value={draft.activity}
            onChange={(e) =>
              setDraft({ ...draft, activity: Number(e.target.value) })
            }
          >
            <option value="1.2">久坐為主</option>
            <option value="1.25">偶爾走動</option>
            <option value="1.35">工作中經常走動</option>
            <option value="1.45">高度勞動工作</option>
          </select>
          <small>男性與女性使用不同基礎代謝公式，運動另外計算。</small>
        </label>
      </div>
      <div className="profile-estimate">
        <span>
          每日目標約 <b>{estimate.targetCalories.toLocaleString()} kcal</b>
        </span>
        <span>
          蛋白質約 <b>{estimate.proteinTarget}g</b>
        </span>
        <span>
          飲水約 <b>{waterTarget(draft).toLocaleString()}ml</b>
        </span>
      </div>
      {mismatch && (
        <p className="form-warning">
          目前體重與目標方向不一致，請重新確認目標體重。
        </p>
      )}
      {risky && (
        <p className="form-warning">
          這個條件不適合自行設定熱量赤字，建議先詢問醫師或營養師。
        </p>
      )}
      <button
        disabled={!valid || mismatch}
        className="primary-button full"
        onClick={() => onSave({ ...draft, name: draft.name.trim() })}
      >
        儲存設定
      </button>
    </Modal>
  );
}
function CustomFoodModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (f: Food) => void;
}) {
  const [f, setF] = useState<Food>({
    id: "custom",
    name: "",
    source: "自行輸入",
    category: "自訂",
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    servingLabel: "自訂份量",
    dataSource: "user",
    sourceName: "使用者自行輸入",
    confidence: "estimated",
  });
  return (
    <Modal title="手動新增餐點" onClose={onClose}>
      <p className="helper">至少填寫餐點名稱與熱量，其餘可先填 0。</p>
      <NutritionFields food={f} setFood={setF} />
      <button
        disabled={!f.name.trim() || f.kcal <= 0}
        className="primary-button full"
        onClick={() => onSave({ ...f, id: uid() })}
      >
        加入今日紀錄
      </button>
    </Modal>
  );
}
function EditFoodModal({
  log,
  onClose,
  onSave,
}: {
  log: FoodLog;
  onClose: () => void;
  onSave: (f: FoodLog) => void;
}) {
  const [draft, setDraft] = useState(log);
  return (
    <Modal title="修改餐點與份量" onClose={onClose}>
      <div className="edit-meta">
        <label>
          餐別
          <select
            value={draft.meal || "其他"}
            onChange={(e) =>
              setDraft({ ...draft, meal: e.target.value as MealType })
            }
          >
            {(["早餐", "午餐", "晚餐", "點心", "其他"] as MealType[]).map(
              (x) => (
                <option key={x}>{x}</option>
              ),
            )}
          </select>
        </label>
        <label>
          日期
          <input
            type="date"
            max={dateKey()}
            value={draft.date}
            onChange={(e) => setDraft({ ...draft, date: e.target.value })}
          />
        </label>
      </div>
      <label className="serving-control">
        份量
        <div>
          <button
            onClick={() =>
              setDraft({
                ...draft,
                servings: clamp(draft.servings - 0.5, 0.5, 10),
              })
            }
          >
            −
          </button>
          <b>{draft.servings} 份</b>
          <button
            onClick={() =>
              setDraft({
                ...draft,
                servings: clamp(draft.servings + 0.5, 0.5, 10),
              })
            }
          >
            ＋
          </button>
        </div>
      </label>
      <NutritionFields
        food={draft}
        setFood={(x) => setDraft({ ...draft, ...x })}
      />
      <button className="primary-button full" onClick={() => onSave(draft)}>
        儲存修改
      </button>
    </Modal>
  );
}
function RecipeModal({
  items,
  onClose,
  onSave,
}: {
  items: FoodLog[];
  onClose: () => void;
  onSave: (name: string, selectedIds: string[]) => void;
}) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState(items.map((x) => x.logId));
  const toggle = (id: string) =>
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
  return (
    <Modal title="建立自訂食譜" onClose={onClose}>
      <p className="helper">
        只勾選屬於這份食譜的食材，不會再把整天餐點全部存入。
      </p>
      <div className="form-grid">
        <label className="span-2">
          食譜名稱
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：我的運動後早餐"
          />
        </label>
      </div>
      <div className="recipe-picker">
        {items.map((x) => (
          <label key={x.logId}>
            <input
              type="checkbox"
              checked={selected.includes(x.logId)}
              onChange={() => toggle(x.logId)}
            />
            <span>
              <b>{x.name}</b>
              <small>
                {x.meal || "其他"}・{x.servings} 份
              </small>
            </span>
          </label>
        ))}
      </div>
      <button
        disabled={!name.trim() || !selected.length}
        className="primary-button full"
        onClick={() => onSave(name.trim(), selected)}
      >
        儲存 {selected.length} 項食材
      </button>
    </Modal>
  );
}
function ReportModal({
  food,
  onClose,
  onSave,
}: {
  food: Food;
  onClose: () => void;
  onSave: (message: string) => void;
}) {
  const [message, setMessage] = useState("");
  return (
    <Modal title="回報餐點資料" onClose={onClose}>
      <p className="helper">
        回報「{food.name}」可能有誤的熱量、份量或營養資料。
      </p>
      <label className="textarea-label">
        問題說明
        <textarea
          autoFocus
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="例如：這個品項應該是一顆，不是一份組合"
        />
      </label>
      <button
        disabled={!message.trim()}
        className="primary-button full"
        onClick={() => onSave(message.trim())}
      >
        送出回報
      </button>
    </Modal>
  );
}
function NutritionFields({
  food,
  setFood,
}: {
  food: Food;
  setFood: (f: Food) => void;
}) {
  const updateNumber = (
    key: "kcal" | "protein" | "carbs" | "fat" | "sodium" | "sugar" | "fiber",
    value: string,
  ) => {
    const parsed = Number(value);
    const maximum = key === "sodium" ? 100000 : key === "kcal" ? 10000 : 1000;
    setFood({
      ...food,
      [key]: Number.isFinite(parsed) ? clamp(parsed, 0, maximum) : 0,
    });
  };
  return (
    <div className="form-grid">
      <label className="span-2">
        餐點名稱
        <input
          value={food.name}
          onChange={(e) => setFood({ ...food, name: e.target.value })}
        />
      </label>
      <label>
        每份熱量
        <input
          type="number"
          min="0"
          max="10000"
          step="1"
          value={food.kcal || ""}
          onChange={(e) => updateNumber("kcal", e.target.value)}
        />
      </label>
      <label>
        蛋白質（g）
        <input
          type="number"
          min="0"
          max="1000"
          step="0.1"
          value={food.protein || ""}
          onChange={(e) => updateNumber("protein", e.target.value)}
        />
      </label>
      <label>
        碳水（g）
        <input
          type="number"
          min="0"
          max="1000"
          step="0.1"
          value={food.carbs || ""}
          onChange={(e) => updateNumber("carbs", e.target.value)}
        />
      </label>
      <label>
        脂肪（g）
        <input
          type="number"
          min="0"
          max="1000"
          step="0.1"
          value={food.fat || ""}
          onChange={(e) => updateNumber("fat", e.target.value)}
        />
      </label>
      <label>
        鈉（mg）
        <input
          type="number"
          min="0"
          max="100000"
          step="1"
          value={food.sodium || ""}
          onChange={(e) => updateNumber("sodium", e.target.value)}
        />
      </label>
      <label>
        糖（g）
        <input
          type="number"
          min="0"
          max="1000"
          step="0.1"
          value={food.sugar || ""}
          onChange={(e) => updateNumber("sugar", e.target.value)}
        />
      </label>
      <label>
        膳食纖維（g）
        <input
          type="number"
          min="0"
          max="1000"
          step="0.1"
          value={food.fiber || ""}
          onChange={(e) => updateNumber("fiber", e.target.value)}
        />
      </label>
    </div>
  );
}
function ExerciseModal({
  weight,
  onClose,
  onSave,
}: {
  weight: number;
  onClose: () => void;
  onSave: (x: {
    name: string;
    minutes: number;
    met: number;
    kcal: number;
  }) => void;
}) {
  const [name, setName] = useState(EXERCISES[0].name);
  const [minutes, setMinutes] = useState(40);
  const item = EXERCISES.find((x) => x.name === name)!;
  const safeMinutes = clamp(Number.isFinite(minutes) ? minutes : 0, 0, 600);
  const kcal = calculateExerciseCalories(item.met, weight, safeMinutes);
  return (
    <Modal title="記錄運動" onClose={onClose}>
      <div className="form-grid">
        <label className="span-2">
          運動類型
          <select value={name} onChange={(e) => setName(e.target.value)}>
            {EXERCISES.map((x) => (
              <option key={x.name}>{x.name}</option>
            ))}
          </select>
        </label>
        <label>
          時間（分鐘）
          <input
            type="number"
            min="1"
            max="600"
            value={minutes}
            onChange={(e) =>
              setMinutes(clamp(Number(e.target.value) || 0, 0, 600))
            }
          />
        </label>
        <div className="estimate-box">
          <span>估算消耗</span>
          <strong>{kcal} kcal</strong>
        </div>
      </div>
      <p className="helper">依體重、時間與 MET 強度估算，實際消耗可能不同。</p>
      <button
        className="primary-button full"
        disabled={safeMinutes < 1 || kcal < 1}
        onClick={() =>
          onSave({ name, minutes: safeMinutes, met: item.met, kcal })
        }
      >
        加入今日紀錄
      </button>
    </Modal>
  );
}

function DailyCalendar({
  month,
  selectedDate,
  today,
  state,
  onMonthChange,
  onSelectDate,
  onWeight,
}: {
  month: string;
  selectedDate: string;
  today: string;
  state: AppState;
  onMonthChange: (month: string) => void;
  onSelectDate: (date: string) => void;
  onWeight: (date: string, value: number) => void;
}) {
  const dates = useMemo(() => getCalendarMonthDates(month), [month]);
  const weightByDate = useMemo(
    () => new Map(state.weights.map((item) => [item.date, item.value])),
    [state.weights],
  );
  const selectedWeight = weightByDate.get(selectedDate);
  const [weightDraft, setWeightDraft] = useState({
    date: selectedDate,
    value: selectedWeight === undefined ? "" : String(selectedWeight),
  });
  const weightValue =
    weightDraft.date === selectedDate
      ? weightDraft.value
      : selectedWeight === undefined
        ? ""
        : String(selectedWeight);
  const statusByDate = useMemo(() => {
    const result = new Map<
      string,
      ReturnType<typeof calculateDailyDeficit>
    >();
    dates.forEach((date) => {
      if (!date) return;
      result.set(
        date,
        calculateDailyDeficit(
          {
            ...state.profile,
            weight: getWeightOnDate(
              state.weights,
              date,
              state.profile.weight,
            ),
          },
          state.foods.filter((item) => item.date === date),
          state.exercises.filter((item) => item.date === date),
        ),
      );
    });
    return result;
  }, [dates, state.exercises, state.foods, state.profile, state.weights]);
  const selectedStatus =
    statusByDate.get(selectedDate) ||
    calculateDailyDeficit(
      {
        ...state.profile,
        weight: getWeightOnDate(
          state.weights,
          selectedDate,
          state.profile.weight,
        ),
      },
      state.foods.filter((item) => item.date === selectedDate),
      state.exercises.filter((item) => item.date === selectedDate),
    );

  const monthLabel = new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "long",
  }).format(dateFromKey(`${month}-01`));
  const selectedLabel = new Intl.DateTimeFormat("zh-TW", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(dateFromKey(selectedDate));
  const parsedWeight = Number(weightValue);
  const todayMonth = today.slice(0, 7);

  return (
    <section
      id="daily-calendar"
      className="daily-calendar"
      aria-label="每日體重與熱量日曆"
    >
      <div className="calendar-header">
        <button
          onClick={() => onMonthChange(shiftMonthKey(month, -1))}
          aria-label="上一個月"
        >
          ‹
        </button>
        <div>
          <b>{monthLabel}</b>
          <span>體重・每日熱量赤字</span>
          {selectedDate !== today && (
            <button
              className="calendar-today-shortcut"
              onClick={() => onSelectDate(today)}
            >
              回到今天
            </button>
          )}
        </div>
        <button
          disabled={month >= todayMonth}
          onClick={() => onMonthChange(shiftMonthKey(month, 1))}
          aria-label="下一個月"
        >
          ›
        </button>
      </div>
      <div className="calendar-weekdays" aria-hidden="true">
        {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="calendar-days">
        {dates.map((date, index) => {
          if (!date)
            return <span className="calendar-empty" key={`empty-${index}`} />;
          const status = statusByDate.get(date);
          const weight = weightByDate.get(date);
          const isFuture = date > today;
          const deficit = status?.deficit;
          const energyLabel =
            deficit === null || deficit === undefined
              ? "熱量未記"
              : deficit >= 0
                ? `赤字 ${deficit}`
                : `盈餘 ${Math.abs(deficit)}`;
          const accessibleLabel = `${date.slice(5).replace("-", "月")}日，${weight === undefined ? "未記體重" : `${weight.toFixed(1)}公斤`}，${energyLabel}`;
          return (
            <button
              key={date}
              disabled={isFuture}
              className={[
                date === selectedDate ? "selected" : "",
                date === today ? "today" : "",
                weight !== undefined ||
                (deficit !== null && deficit !== undefined)
                  ? "has-data"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label={accessibleLabel}
              aria-pressed={date === selectedDate}
              onClick={() => onSelectDate(date)}
            >
              <b>{Number(date.slice(-2))}</b>
              <span>{weight === undefined ? "— kg" : `${weight.toFixed(1)} kg`}</span>
              <small
                className={
                  deficit === null || deficit === undefined
                    ? "empty"
                    : deficit >= 0
                      ? "deficit"
                      : "surplus"
                }
              >
                {energyLabel}
              </small>
            </button>
          );
        })}
      </div>
      <div className="calendar-detail">
        <div className="calendar-day-summary">
          <p>{selectedDate === today ? `今天・${selectedLabel}` : selectedLabel}</p>
          <div>
            <span>
              攝取 <b>{selectedStatus.intake} kcal</b>
            </span>
            <span>
              運動 <b>{selectedStatus.exercise} kcal</b>
            </span>
            <span>
              熱量
              <b
                className={
                  selectedStatus.deficit === null
                    ? ""
                    : selectedStatus.deficit >= 0
                      ? "deficit"
                      : "surplus"
                }
              >
                {selectedStatus.deficit === null
                  ? "尚未記錄"
                  : selectedStatus.deficit >= 0
                    ? `赤字 ${selectedStatus.deficit} kcal`
                    : `盈餘 ${Math.abs(selectedStatus.deficit)} kcal`}
              </b>
            </span>
          </div>
        </div>
        <form
          className="calendar-weight-form"
          onSubmit={(event) => {
            event.preventDefault();
            onWeight(selectedDate, parsedWeight);
          }}
        >
          <label htmlFor="daily-weight-input">{selectedLabel}體重</label>
          <div>
            <input
              id="daily-weight-input"
              type="number"
              inputMode="decimal"
              min="20"
              max="400"
              step="0.1"
              value={weightValue}
              onChange={(event) =>
                setWeightDraft({
                  date: selectedDate,
                  value: event.target.value,
                })
              }
              placeholder="例如 70.2"
            />
            <span>kg</span>
          </div>
          <button
            type="submit"
            disabled={
              !Number.isFinite(parsedWeight) ||
              parsedWeight < 20 ||
              parsedWeight > 400
            }
          >
            {selectedWeight === undefined ? "儲存體重" : "更新體重"}
          </button>
        </form>
      </div>
      <p className="calendar-note">
        熱量赤字＝估算維持熱量（含運動）－已記錄攝取；未完整記錄飲食的日期不顯示赤字。
      </p>
    </section>
  );
}

function History({
  state,
  progress,
  weightDelta,
  onWeight,
  onExport,
}: {
  state: AppState;
  progress: number;
  weightDelta: number;
  onWeight: (n: number) => void;
  onExport: () => void;
}) {
  const [value, setValue] = useState("");
  const [range, setRange] = useState<7 | 30>(30);
  const days = lastDays(range);
  const daily = days.map((date) => {
    const foods = state.foods.filter((x) => x.date === date);
    const exercises = state.exercises.filter((x) => x.date === date);
    return { date, ...calculateEnergyTotals(state.profile, foods, exercises) };
  });
  const logged = daily.filter((x) => x.intake > 0);
  const avgKcal = logged.length
    ? Math.round(logged.reduce((a, x) => a + x.intake, 0) / logged.length)
    : 0;
  const avgProtein = logged.length
    ? Math.round(logged.reduce((a, x) => a + x.protein, 0) / logged.length)
    : 0;
  const periodExercises = state.exercises.filter((x) => days.includes(x.date));
  const exerciseMinutes = periodExercises.reduce((a, x) => a + x.minutes, 0);
  const personalWaterTarget = waterTarget(state.profile);
  const waterDays = days.filter(
    (d) => (state.water[d] || 0) >= personalWaterTarget,
  ).length;
  const baseTotals = calculateEnergyTotals(state.profile, [], []);
  const calorieDays = logged.filter(
    (x) =>
      x.intake >= baseTotals.targetCalories * 0.8 &&
      x.intake <= baseTotals.targetCalories * 1.2,
  ).length;
  const proteinDays = logged.filter(
    (x) => x.protein >= baseTotals.proteinTarget * 0.8,
  ).length;
  const points = state.weights.filter((x) => days.includes(x.date)).slice(-15);
  const min = points.length
    ? Math.min(...points.map((x) => x.value), state.profile.target) - 1
    : 0;
  const max = points.length ? Math.max(...points.map((x) => x.value)) + 1 : 1;
  const path = points
    .map(
      (x, i) =>
        `${i === 0 ? "M" : "L"} ${points.length === 1 ? 50 : (i / (points.length - 1)) * 100} ${90 - ((x.value - min) / Math.max(0.1, max - min)) * 70}`,
    )
    .join(" ");
  const periodWeightDelta =
    points.length >= 2
      ? points[points.length - 1].value - points[0].value
      : weightDelta;
  const onTrack =
    state.profile.goalMode === "gain"
      ? periodWeightDelta >= 0
      : state.profile.goalMode === "cut"
        ? periodWeightDelta <= 0
        : Math.abs(periodWeightDelta) <= 1;
  const insights: string[] = [];
  if (logged.length < Math.ceil(range * 0.5))
    insights.push(
      `只有 ${logged.length} 天完成飲食紀錄，先把目標設為每週記 4 天，比追求完美更容易持續。`,
    );
  else if (calorieDays / logged.length < 0.6)
    insights.push(
      `有 ${calorieDays} 天落在目標熱量附近；份量落差較大時，可多使用常用食譜與最近吃過。`,
    );
  else
    insights.push(
      `已有 ${calorieDays} 天落在目標熱量的合理範圍，整體節奏相當穩定。`,
    );
  if (proteinDays < Math.max(3, logged.length * 0.6))
    insights.push(
      `蛋白質達到八成目標的天數是 ${proteinDays} 天，可優先補茶葉蛋、豆漿、雞胸或豆腐。`,
    );
  if (points.length < 2)
    insights.push(
      "體重資料不足兩筆，先固定每週同一時間記錄，不必每天被水分波動影響。",
    );
  else if (!onTrack)
    insights.push(
      `體重趨勢與「${state.profile.goalMode === "gain" ? "增肌" : state.profile.goalMode === "cut" ? "減脂" : "維持"}」方向不同，建議先檢查近兩週平均攝取，不要立刻大幅削減或增加。`,
    );
  else insights.push("體重方向與目前目標一致，維持兩週再決定是否調整熱量。");
  return (
    <section className="history-page">
      <div className="welcome">
        <div>
          <p>最近 {range} 天</p>
          <h1>看長期方向，不被單日數字影響。</h1>
          <span>體重會受水分、鹽分與睡眠影響，週平均更值得參考。</span>
        </div>
        <div className="history-actions">
          <div className="range-toggle">
            <button
              className={range === 7 ? "active" : ""}
              onClick={() => setRange(7)}
            >
              7 天
            </button>
            <button
              className={range === 30 ? "active" : ""}
              onClick={() => setRange(30)}
            >
              30 天
            </button>
          </div>
          <button className="soft-button" onClick={onExport}>
            匯出完整紀錄
          </button>
        </div>
      </div>
      <div className="weekly-grid">
        <Metric
          title="平均攝取"
          value={avgKcal}
          unit="kcal／天"
          tone="coral"
          note={`${logged.length} 天有飲食紀錄`}
        />
        <Metric
          title="平均蛋白質"
          value={avgProtein}
          unit="g／天"
          tone="purple"
          note={`目標約 ${baseTotals.proteinTarget}g`}
        />
        <Metric
          title="運動時間"
          value={exerciseMinutes}
          unit="分鐘"
          tone="blue"
          note={`${periodExercises.length} 筆運動`}
        />
        <Metric
          title="飲水達標"
          value={waterDays}
          unit={`／ ${range} 天`}
          tone="green"
          note={`每日約 ${personalWaterTarget.toLocaleString()} ml`}
        />
      </div>
      <article className="card month-review">
        <div className="section-title">
          <div>
            <p>免 AI・本機分析</p>
            <h2>{range} 天教練回顧</h2>
          </div>
          <span>{logged.length} 天有記錄</span>
        </div>
        <div className="review-badges">
          <b>熱量穩定 {calorieDays} 天</b>
          <b>蛋白質達標 {proteinDays} 天</b>
          <b>運動 {exerciseMinutes} 分鐘</b>
        </div>
        <ul>
          {insights.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </article>
      <div className="history-grid">
        <article className="card trend-card">
          <div className="section-title">
            <div>
              <p>體重變化</p>
              <h2>{state.profile.weight.toFixed(1)} kg</h2>
            </div>
            <span className={onTrack ? "good" : "warn"}>
              {periodWeightDelta < 0 ? "↓" : periodWeightDelta > 0 ? "↑" : "—"}{" "}
              {Math.abs(periodWeightDelta).toFixed(1)} kg
            </span>
          </div>
          {points.length ? (
            <>
              <svg
                className="weight-chart"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <path
                  d={path}
                  fill="none"
                  stroke="#407fbe"
                  strokeWidth="2.2"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={`${path} L 100 100 L 0 100 Z`}
                  fill="url(#chartFade)"
                  opacity=".2"
                />
                <defs>
                  <linearGradient id="chartFade" x1="0" x2="0" y1="0" y2="1">
                    <stop stopColor="#407fbe" />
                    <stop offset="1" stopColor="#fff" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="chart-labels">
                {points.map((x) => (
                  <span key={x.date}>{x.date.slice(5).replace("-", "/")}</span>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-trend">還沒有這段期間的體重資料</div>
          )}
        </article>
        <article className="card progress-card">
          <p>目標進度</p>
          <div
            className="ring"
            style={
              { "--progress": `${progress * 3.6}deg` } as React.CSSProperties
            }
          >
            <span>
              <b>{Math.round(progress)}%</b>完成
            </span>
          </div>
          <div>
            <span>
              目前 <b>{state.profile.weight.toFixed(1)} kg</b>
            </span>
            <span>
              目標 <b>{state.profile.target.toFixed(1)} kg</b>
            </span>
          </div>
        </article>
        <article className="card weight-entry-card">
          <p>今日體重</p>
          <h2>建立穩定紀錄</h2>
          <div>
            <input
              type="number"
              min="20"
              max="400"
              step=".1"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="例如 91.2"
            />
            <span>kg</span>
          </div>
          <button
            disabled={Number(value) < 20 || Number(value) > 400}
            className="primary-button full"
            onClick={() => {
              onWeight(Number(value));
              setValue("");
            }}
          >
            儲存今日體重
          </button>
        </article>
      </div>
    </section>
  );
}
function Logo() {
  return (
    <svg viewBox="0 0 36 36" aria-hidden="true">
      <path d="M18 4.5c5.3 0 9.8 3.5 11.3 8.3.5 1.7.6 3.8-.2 5.5-1 2.1-3.2 3.1-5.4 3.1H12.3c-2.2 0-4.4-1-5.4-3.1-.8-1.7-.7-3.8-.2-5.5C8.2 8 12.7 4.5 18 4.5Z" />
      <path d="M12.2 21.3v3.2c0 3.4 2.6 6.2 5.8 6.2s5.8-2.8 5.8-6.2v-3.2M13.3 13.8c1.3-1.1 2.9-1.7 4.7-1.7s3.4.6 4.7 1.7" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3v3M17 3v3M4.5 9h15M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
      <path d="M8 12h2v2H8zM14 12h2v2h-2zM8 16h2v2H8zM14 16h2v2h-2z" />
    </svg>
  );
}
function ThemeIcon({ dark }: { dark: boolean }) {
  return dark ? (
    <svg viewBox="0 0 24 24">
      <path d="M20 15.5A8 8 0 0 1 8.5 4 8 8 0 1 0 20 15.5Z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24">
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.8-4 3.1-6 7-6s6.2 2 7 6" />
    </svg>
  );
}
