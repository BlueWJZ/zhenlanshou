export type EnergyGoalMode = "cut" | "maintain" | "gain";

export type EnergyProfile = {
  sex: "male" | "female";
  age: number;
  height: number;
  weight: number;
  target: number;
  activity: number;
  goalMode: EnergyGoalMode;
};

export type EnergyFood = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  sodium?: number;
  sugar?: number;
  fiber?: number;
  servings: number;
};

export type EnergyExercise = { kcal: number };

const finite = (value: number, fallback = 0) =>
  Number.isFinite(value) ? value : fallback;

const safeProduct = (value: number, servings: number) =>
  Math.max(0, finite(value)) * Math.max(0, finite(servings));

export function calculateEnergyTotals(
  profile: EnergyProfile,
  foods: EnergyFood[],
  exercises: EnergyExercise[],
) {
  const weight = Math.max(1, finite(profile.weight, 70));
  const height = Math.max(1, finite(profile.height, 170));
  const age = Math.max(1, finite(profile.age, 30));
  const activity = Math.max(1, finite(profile.activity, 1.2));
  const bmr = Math.max(
    0,
    Math.round(
      10 * weight +
        6.25 * height -
        5 * age +
        (profile.sex === "male" ? 5 : -161),
    ),
  );
  const baseline = Math.max(0, Math.round(bmr * activity));
  const intake = foods.reduce(
    (total, food) => total + safeProduct(food.kcal, food.servings),
    0,
  );
  const protein = foods.reduce(
    (total, food) => total + safeProduct(food.protein, food.servings),
    0,
  );
  const carbs = foods.reduce(
    (total, food) => total + safeProduct(food.carbs, food.servings),
    0,
  );
  const fat = foods.reduce(
    (total, food) => total + safeProduct(food.fat, food.servings),
    0,
  );
  const sodium = foods.reduce(
    (total, food) => total + safeProduct(food.sodium || 0, food.servings),
    0,
  );
  const sugar = foods.reduce(
    (total, food) => total + safeProduct(food.sugar || 0, food.servings),
    0,
  );
  const fiber = foods.reduce(
    (total, food) => total + safeProduct(food.fiber || 0, food.servings),
    0,
  );
  const exercise = exercises.reduce(
    (total, item) => total + Math.max(0, finite(item.kcal)),
    0,
  );
  const maintenance = baseline + exercise;
  const adjustment =
    profile.goalMode === "cut"
      ? -Math.min(500, Math.round(baseline * 0.2))
      : profile.goalMode === "gain"
        ? Math.min(350, Math.round(baseline * 0.15))
        : 0;
  const safetyFloor = profile.sex === "male" ? 1500 : 1200;
  const targetCalories = Math.max(safetyFloor, baseline + adjustment);
  const proteinBase =
    profile.goalMode === "gain"
      ? Math.max(weight, finite(profile.target, weight))
      : Math.min(
          weight,
          Math.max(
            finite(profile.target, weight),
            (height / 100) ** 2 * 27,
          ),
        );
  const proteinTarget = Math.round(
    proteinBase * (profile.goalMode === "gain" ? 1.8 : 1.6),
  );

  return {
    bmr,
    baseline,
    intake,
    protein,
    carbs,
    fat,
    sodium,
    sugar,
    fiber,
    exercise,
    maintenance,
    targetCalories,
    balance: intake - maintenance,
    proteinTarget,
  };
}

export const calculateExerciseCalories = (
  met: number,
  weight: number,
  minutes: number,
) =>
  Math.max(
    0,
    Math.round(
      ((Math.max(0, finite(met)) * 3.5 * Math.max(0, finite(weight))) / 200) *
        Math.max(0, finite(minutes)),
    ),
  );

export type ReminderSchedule = {
  enabled: boolean;
  breakfast: string;
  lunch: string;
  dinner: string;
  waterEnabled: boolean;
  waterStart: string;
  waterEnd: string;
  waterInterval: number;
};

export type DueReminder = {
  id: string;
  scheduledTime: string;
  message: string;
};

const timeToMinutes = (value: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
};

const minutesToTime = (value: number) =>
  `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;

const isDue = (current: number, scheduled: number, grace: number) =>
  current >= scheduled && current - scheduled <= grace;

export function getDueReminders(
  reminders: ReminderSchedule,
  now: Date,
  graceMinutes = 5,
): DueReminder[] {
  const current = now.getHours() * 60 + now.getMinutes();
  const grace = Math.max(0, Math.min(15, Math.round(graceMinutes)));
  const due: DueReminder[] = [];

  if (reminders.enabled) {
    const meals = [
      ["breakfast", reminders.breakfast, "早餐"],
      ["lunch", reminders.lunch, "午餐"],
      ["dinner", reminders.dinner, "晚餐"],
    ] as const;
    for (const [id, time, label] of meals) {
      const scheduled = timeToMinutes(time);
      if (scheduled !== null && isDue(current, scheduled, grace)) {
        due.push({
          id: `meal-${id}`,
          scheduledTime: minutesToTime(scheduled),
          message: `${label}時間到了，花 10 秒記下吃了什麼。`,
        });
      }
    }
  }

  if (reminders.waterEnabled) {
    const start = timeToMinutes(reminders.waterStart);
    const end = timeToMinutes(reminders.waterEnd);
    const interval = Math.max(30, Math.round(finite(reminders.waterInterval, 120)));
    if (
      start !== null &&
      end !== null &&
      start <= end &&
      current >= start &&
      current <= end
    ) {
      const scheduled = start + Math.floor((current - start) / interval) * interval;
      if (scheduled <= end && isDue(current, scheduled, grace)) {
        due.push({
          id: "water",
          scheduledTime: minutesToTime(scheduled),
          message: "喝水時間到了，補充一杯水並記錄今天的飲水量。",
        });
      }
    }
  }

  return due;
}
