import type { Food } from "./data";
import type { EnergyGoalMode } from "./domain";

export type GoalMode = EnergyGoalMode;
export type MealType = "早餐" | "午餐" | "晚餐" | "點心" | "其他";
export type FoodLog = Food & {
  logId: string;
  date: string;
  servings: number;
  meal?: MealType;
};
export type ExerciseLog = {
  logId: string;
  date: string;
  name: string;
  minutes: number;
  met: number;
  kcal: number;
};
export type WeightLog = { date: string; value: number };
export type SleepLog = { hours: number; quality: "普通" | "良好" | "很棒" };
export type Combo = { id: string; name: string; foodIds: string[] };
export type Recipe = { id: string; name: string; items: FoodLog[] };
export type FoodReport = {
  id: string;
  foodId: string;
  foodName: string;
  message: string;
  date: string;
};
export type Reminders = {
  notificationsEnabled: boolean;
  enabled: boolean;
  breakfast: string;
  lunch: string;
  dinner: string;
  waterEnabled: boolean;
  waterStart: string;
  waterEnd: string;
  waterInterval: number;
};
export type Profile = {
  name: string;
  sex: "male" | "female";
  age: number;
  height: number;
  weight: number;
  target: number;
  activity: number;
  goalMode: GoalMode;
};
export type AppState = {
  profile: Profile;
  foods: FoodLog[];
  exercises: ExerciseLog[];
  weights: WeightLog[];
  favorites: string[];
  combos: Combo[];
  recipes: Recipe[];
  reports: FoodReport[];
  reminders: Reminders;
  water: Record<string, number>;
  sleep: Record<string, SleepLog>;
};

export const APP_STORAGE_KEY = "eat-right-v3";
export const LEGACY_STORAGE_KEY = "eat-right-v2";
export const THEME_STORAGE_KEY = "trueblue-theme";
export const BARCODE_CACHE_KEY = "trueblue-barcode-cache-v1";
export const RECOVERY_STORAGE_KEY = "trueblue-recovery-v1";
export const BACKUP_SCHEMA_VERSION = 1;

export const INITIAL_STATE: AppState = {
  profile: {
    name: "你",
    sex: "male",
    age: 30,
    height: 170,
    weight: 70,
    target: 65,
    activity: 1.25,
    goalMode: "maintain",
  },
  foods: [],
  exercises: [],
  favorites: [],
  combos: [],
  recipes: [],
  reports: [],
  reminders: {
    notificationsEnabled: false,
    enabled: false,
    breakfast: "08:00",
    lunch: "12:30",
    dinner: "19:00",
    waterEnabled: false,
    waterStart: "09:00",
    waterEnd: "21:00",
    waterInterval: 120,
  },
  water: {},
  sleep: {},
  weights: [],
};

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const asArray = (value: unknown) => (Array.isArray(value) ? value : []);
const text = (value: unknown, fallback: string, max = 120) =>
  typeof value === "string" && value.trim()
    ? value.trim().slice(0, max)
    : fallback;
const number = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};
const boolean = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;
const validDate = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(new Date(`${value}T12:00:00`).getTime());
const validTime = (value: unknown, fallback: string) =>
  typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
    ? value
    : fallback;
const stringList = (value: unknown, limit = 20000) => [
  ...new Set(
    asArray(value)
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.slice(0, 160))
      .filter(Boolean)
      .slice(0, limit),
  ),
];

const normalizeFood = (value: unknown, index: number): FoodLog | null => {
  if (!isRecord(value) || !validDate(value.date)) return null;
  const name = text(value.name, "", 160);
  if (!name) return null;
  const mealOptions: MealType[] = ["早餐", "午餐", "晚餐", "點心", "其他"];
  const meal = mealOptions.includes(value.meal as MealType)
    ? (value.meal as MealType)
    : "其他";
  return {
    ...(value as Food),
    id: text(value.id, `recovered-food-${index}`, 180),
    logId: text(value.logId, `recovered-log-${index}`, 180),
    name,
    source: text(value.source, "來源未註明", 120),
    category: text(value.category, "其他", 80),
    kcal: number(value.kcal, 0, 0, 10000),
    protein: number(value.protein, 0, 0, 1000),
    carbs: number(value.carbs, 0, 0, 1000),
    fat: number(value.fat, 0, 0, 1000),
    sodium: number(value.sodium, 0, 0, 100000),
    sugar: number(value.sugar, 0, 0, 1000),
    fiber: number(value.fiber, 0, 0, 1000),
    servings: number(value.servings, 1, 0.05, 100),
    date: value.date,
    meal,
  };
};

export function normalizeAppState(value: unknown): AppState {
  const raw = isRecord(value) ? value : {};
  const rawProfile = isRecord(raw.profile) ? raw.profile : {};
  const rawReminders = isRecord(raw.reminders) ? raw.reminders : {};
  const legacyWaterStart = rawReminders.water;
  const activityOptions = [1.2, 1.25, 1.35, 1.45];
  const parsedActivity = number(rawProfile.activity, INITIAL_STATE.profile.activity, 1, 2);
  const activity = activityOptions.includes(parsedActivity)
    ? parsedActivity
    : INITIAL_STATE.profile.activity;
  const sex = rawProfile.sex === "female" ? "female" : "male";
  const goalMode: GoalMode = ["cut", "maintain", "gain"].includes(
    String(rawProfile.goalMode),
  )
    ? (rawProfile.goalMode as GoalMode)
    : INITIAL_STATE.profile.goalMode;

  const foods = asArray(raw.foods)
    .slice(-20000)
    .map(normalizeFood)
    .filter((item): item is FoodLog => item !== null);
  const exercises = asArray(raw.exercises)
    .slice(-20000)
    .map((item, index): ExerciseLog | null => {
      if (!isRecord(item) || !validDate(item.date)) return null;
      return {
        logId: text(item.logId, `recovered-exercise-${index}`, 180),
        date: item.date,
        name: text(item.name, "未命名運動", 120),
        minutes: number(item.minutes, 1, 1, 600),
        met: number(item.met, 1, 0.5, 25),
        kcal: number(item.kcal, 0, 0, 10000),
      };
    })
    .filter((item): item is ExerciseLog => item !== null);
  const weightMap = new Map<string, number>();
  asArray(raw.weights)
    .slice(-10000)
    .forEach((item) => {
      if (isRecord(item) && validDate(item.date))
        weightMap.set(item.date, number(item.value, 70, 20, 400));
    });
  const weights = [...weightMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));

  const combos = asArray(raw.combos)
    .slice(-2000)
    .map((item, index): Combo | null =>
      isRecord(item)
        ? {
            id: text(item.id, `recovered-combo-${index}`, 180),
            name: text(item.name, `常用組合 ${index + 1}`, 120),
            foodIds: stringList(item.foodIds, 100),
          }
        : null,
    )
    .filter((item): item is Combo => item !== null);
  const recipes = asArray(raw.recipes)
    .slice(-2000)
    .map((item, index): Recipe | null => {
      if (!isRecord(item)) return null;
      const items = asArray(item.items)
        .slice(0, 200)
        .map((food, foodIndex) => normalizeFood(food, index * 1000 + foodIndex))
        .filter((food): food is FoodLog => food !== null);
      return {
        id: text(item.id, `recovered-recipe-${index}`, 180),
        name: text(item.name, `自訂食譜 ${index + 1}`, 120),
        items,
      };
    })
    .filter((item): item is Recipe => item !== null);
  const reports = asArray(raw.reports)
    .slice(-5000)
    .map((item, index): FoodReport | null =>
      isRecord(item)
        ? {
            id: text(item.id, `recovered-report-${index}`, 180),
            foodId: text(item.foodId, "unknown", 180),
            foodName: text(item.foodName, "未命名餐點", 160),
            message: text(item.message, "未提供說明", 1000),
            date: text(item.date, new Date(0).toISOString(), 40),
          }
        : null,
    )
    .filter((item): item is FoodReport => item !== null);

  const water: Record<string, number> = {};
  if (isRecord(raw.water))
    Object.entries(raw.water)
      .slice(-5000)
      .forEach(([date, amount]) => {
        if (validDate(date)) water[date] = number(amount, 0, 0, 10000);
      });
  const sleep: Record<string, SleepLog> = {};
  if (isRecord(raw.sleep))
    Object.entries(raw.sleep)
      .slice(-5000)
      .forEach(([date, item]) => {
        if (!validDate(date) || !isRecord(item)) return;
        const quality = ["普通", "良好", "很棒"].includes(String(item.quality))
          ? (item.quality as SleepLog["quality"])
          : "良好";
        sleep[date] = { hours: number(item.hours, 7, 0, 24), quality };
      });

  const waterInterval = number(
    rawReminders.waterInterval,
    INITIAL_STATE.reminders.waterInterval,
    30,
    360,
  );
  return {
    profile: {
      name: text(rawProfile.name, INITIAL_STATE.profile.name, 40),
      sex,
      age: number(rawProfile.age, INITIAL_STATE.profile.age, 18, 100),
      height: number(rawProfile.height, INITIAL_STATE.profile.height, 120, 230),
      weight: number(rawProfile.weight, INITIAL_STATE.profile.weight, 20, 400),
      target: number(rawProfile.target, INITIAL_STATE.profile.target, 20, 400),
      activity,
      goalMode,
    },
    foods,
    exercises,
    weights,
    favorites: stringList(raw.favorites),
    combos,
    recipes,
    reports,
    reminders: {
      notificationsEnabled: boolean(rawReminders.notificationsEnabled, false),
      enabled: boolean(rawReminders.enabled, false),
      breakfast: validTime(rawReminders.breakfast, INITIAL_STATE.reminders.breakfast),
      lunch: validTime(rawReminders.lunch, INITIAL_STATE.reminders.lunch),
      dinner: validTime(rawReminders.dinner, INITIAL_STATE.reminders.dinner),
      waterEnabled: boolean(rawReminders.waterEnabled, false),
      waterStart: validTime(
        rawReminders.waterStart || legacyWaterStart,
        INITIAL_STATE.reminders.waterStart,
      ),
      waterEnd: validTime(rawReminders.waterEnd, INITIAL_STATE.reminders.waterEnd),
      waterInterval: [30, 60, 90, 120, 180].includes(waterInterval)
        ? waterInterval
        : INITIAL_STATE.reminders.waterInterval,
    },
    water,
    sleep,
  };
}

export const createBackupPayload = (state: AppState) => ({
  product: "真藍瘦",
  schemaVersion: BACKUP_SCHEMA_VERSION,
  exportedAt: new Date().toISOString(),
  state,
});

export function restoreBackupText(textValue: string): AppState {
  const parsed: unknown = JSON.parse(textValue);
  if (!isRecord(parsed) || parsed.product !== "真藍瘦")
    throw new Error("這不是有效的真藍瘦備份檔");
  const version = Number(parsed.schemaVersion);
  if (!Number.isInteger(version) || version < 1 || version > BACKUP_SCHEMA_VERSION)
    throw new Error("備份版本不受支援，請更新真藍瘦後再試一次");
  if (!isRecord(parsed.state)) throw new Error("備份內容不完整");
  return normalizeAppState(parsed.state);
}
