import { FOOD_LIBRARY, SINGLE_FOODS, type Food } from "./data";
import type { EnergyGoalMode } from "./domain";

export type MealPlanPreference =
  | "auto"
  | "balanced"
  | "high-protein"
  | "light"
  | "training"
  | "convenience"
  | "vegetarian";

export type MealPlanMeal = "早餐" | "午餐" | "晚餐" | "點心";

export type MealPlanContext = {
  targetCalories: number;
  intakeCalories: number;
  proteinTarget: number;
  proteinIntake: number;
  exerciseCalories: number;
  goalMode: EnergyGoalMode;
  date: string;
  seed: number;
  preference: MealPlanPreference;
  loggedMeals: string[];
};

export type MealPlanItem = {
  meal: MealPlanMeal;
  food: Food;
};

export type MealPlan = {
  title: string;
  reason: string;
  tags: string[];
  items: MealPlanItem[];
  totalKcal: number;
  totalProtein: number;
  candidateCount: number;
  isRemainderPlan: boolean;
};

export const MEAL_PLAN_PREFERENCES: {
  id: MealPlanPreference;
  label: string;
}[] = [
  { id: "auto", label: "智慧推薦" },
  { id: "balanced", label: "均衡外食" },
  { id: "high-protein", label: "高蛋白" },
  { id: "light", label: "輕盈減脂" },
  { id: "training", label: "運動日" },
  { id: "convenience", label: "便利商店" },
  { id: "vegetarian", label: "蛋奶素" },
];

const PLAN_FOODS = [...SINGLE_FOODS, ...FOOD_LIBRARY].filter(
  (food) => !/[＋+]/.test(food.name),
);

const finite = (value: number, fallback: number) =>
  Number.isFinite(value) ? value : fallback;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const canonicalName = (name: string) =>
  name
    .replace(/（[^）]*）/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();

const meatWords =
  /雞|鴨|鵝|豬|牛|羊|肉|魚|蝦|蟹|蛤|蚵|鮪|鮭|鯖|鱈|海鮮|火腿|培根|香腸|熱狗|排骨|里肌|控肉|肉燥|肉羹/;
const vegetarianWords =
  /素|蔬|豆腐|豆干|豆漿|毛豆|蛋|牛奶|鮮奶|優格|乳清|燕麥|地瓜|玉米|水果|香蕉|沙拉|菇|吐司|貝果/;
const proteinFoodWords =
  /蛋|雞胸|鮪魚|鮭魚|牛肉|里肌|豆腐|豆干|豆漿|毛豆|牛奶|鮮奶|優格|乳清|植物蛋白/;

const isVegetarian = (food: Food) =>
  food.source === "素食" ||
  (vegetarianWords.test(food.name) && !meatWords.test(food.name));

const isAllowedForMeal = (food: Food, meal: MealPlanMeal) => {
  if (meal === "早餐")
    return (
      food.category === "早餐" ||
      (food.source === "便利商店" &&
        ["蛋白質", "主食", "飲品"].includes(food.category))
    );
  if (meal === "點心")
    return ["運動後", "點心", "水果", "蛋白質", "飲品"].includes(
      food.category,
    );
  return ["便當", "正餐", "高蛋白", "速食", "單點"].includes(
    food.category,
  );
};

const preferenceLabel = (preference: MealPlanPreference) =>
  MEAL_PLAN_PREFERENCES.find((item) => item.id === preference)?.label ||
  "均衡外食";

const resolvePreference = (
  context: MealPlanContext,
): Exclude<MealPlanPreference, "auto"> => {
  if (context.preference !== "auto") return context.preference;
  const proteinGap = context.proteinTarget - context.proteinIntake;
  if (context.exerciseCalories >= 180) return "training";
  if (proteinGap >= Math.max(25, context.proteinTarget * 0.25))
    return "high-protein";
  if (context.goalMode === "cut") return "light";
  return "balanced";
};

const mealScore = (
  food: Food,
  meal: MealPlanMeal,
  target: number,
  preference: Exclude<MealPlanPreference, "auto">,
  goalMode: EnergyGoalMode,
  usedSources: Set<string>,
) => {
  const calorieDistance =
    (Math.abs(food.kcal - target) / Math.max(120, target)) * 64;
  const proteinDensity = (food.protein / Math.max(food.kcal, 50)) * 100;
  let score = calorieDistance;

  if (meal !== "點心" && food.kcal < 220) score += 24;
  if (meal === "點心" && food.kcal > 330) score += 36;
  if (usedSources.has(food.source)) score += 4;

  if (preference === "high-protein") score -= proteinDensity * 1.5;
  if (preference === "training") {
    score -= proteinDensity * 0.8;
    score -= Math.min(food.carbs, 75) * 0.08;
    if (meal === "點心" && food.category !== "運動後") score += 22;
  }
  if (preference === "light") {
    score += food.fat * 0.5;
    score += (food.sugar || 0) * 0.18;
    score -= proteinDensity * 0.75;
  }
  if (preference === "balanced") {
    score += Math.abs(food.protein * 4 - food.kcal * 0.24) * 0.05;
    score += Math.abs(food.fat * 9 - food.kcal * 0.28) * 0.025;
    if (meal === "點心") score += (food.sugar || 0) * 0.65;
  }
  if (preference === "high-protein") score += (food.sugar || 0) * 0.3;
  if (goalMode === "gain") score -= Math.min(food.protein, 45) * 0.14;
  if (goalMode === "cut") score -= proteinDensity * 0.3;

  return score;
};

const preferenceAllows = (
  food: Food,
  preference: Exclude<MealPlanPreference, "auto">,
  meal?: MealPlanMeal,
) => {
  if (preference === "convenience") return food.source === "便利商店";
  if (preference === "vegetarian") return isVegetarian(food);
  if (preference === "high-protein" && meal) {
    const minimum = meal === "點心" ? 8 : meal === "早餐" ? 10 : 18;
    return (
      food.protein >= minimum &&
      (meal === "午餐" || meal === "晚餐" || proteinFoodWords.test(food.name))
    );
  }
  if (preference === "training" && meal === "點心")
    return (
      food.category === "運動後" &&
      food.protein >= 8 &&
      proteinFoodWords.test(food.name)
    );
  if (preference === "light" && meal) {
    if (meal === "點心")
      return (food.sugar || 0) <= 12 && food.fat <= 10 && food.kcal <= 240;
    return food.fat <= (meal === "早餐" ? 18 : 25);
  }
  if (preference === "balanced" && meal === "點心")
    return (food.sugar || 0) <= 22 && food.kcal <= 280;
  return true;
};

const uniqueCandidates = (
  meal: MealPlanMeal,
  target: number,
  preference: Exclude<MealPlanPreference, "auto">,
  goalMode: EnergyGoalMode,
  usedNames: Set<string>,
  usedSources: Set<string>,
) => {
  const byName = new Map<string, { food: Food; score: number }>();

  PLAN_FOODS.forEach((food) => {
    const name = canonicalName(food.name);
    if (
      usedNames.has(name) ||
      !isAllowedForMeal(food, meal) ||
      !preferenceAllows(food, preference, meal)
    )
      return;
    const score = mealScore(
      food,
      meal,
      target,
      preference,
      goalMode,
      usedSources,
    );
    const current = byName.get(name);
    if (!current || score < current.score) byName.set(name, { food, score });
  });

  return [...byName.values()].sort((a, b) => a.score - b.score);
};

const selectFood = (
  meal: MealPlanMeal,
  target: number,
  context: MealPlanContext,
  preference: Exclude<MealPlanPreference, "auto">,
  usedNames: Set<string>,
  usedSources: Set<string>,
  index: number,
) => {
  let candidates = uniqueCandidates(
    meal,
    target,
    preference,
    context.goalMode,
    usedNames,
    usedSources,
  );

  // 極端篩選條件下仍提供安全的通用候選，不讓畫面出現空白方案。
  if (!candidates.length)
    candidates = uniqueCandidates(
      meal,
      target,
      "balanced",
      context.goalMode,
      usedNames,
      usedSources,
    );

  const bestScore = candidates[0]?.score ?? 0;
  const scoreWindow = preference === "high-protein" ? 16 : 24;
  const goodMatches = candidates
    .filter((candidate) => candidate.score <= bestScore + scoreWindow)
    .slice(0, 32);
  const window = goodMatches.length ? goodMatches : candidates.slice(0, 12);
  const rotation = hashString(
    `${context.date}|${context.seed}|${context.preference}|${meal}|${index}`,
  );
  return window[rotation % Math.max(1, window.length)]?.food;
};

const getCandidateCount = (
  preference: Exclude<MealPlanPreference, "auto">,
) =>
  new Set(
    PLAN_FOODS.filter((food) =>
      (["早餐", "午餐", "晚餐", "點心"] as MealPlanMeal[]).some(
        (meal) =>
          isAllowedForMeal(food, meal) &&
          preferenceAllows(food, preference, meal),
      ),
    ).map((food) => `${food.source}:${canonicalName(food.name)}`),
  ).size;

const mealRatios: Record<MealPlanMeal, number> = {
  早餐: 0.23,
  午餐: 0.34,
  晚餐: 0.32,
  點心: 0.11,
};

export function buildMealPlan(context: MealPlanContext): MealPlan {
  const targetCalories = clamp(
    finite(context.targetCalories, 1800),
    1000,
    5000,
  );
  const intakeCalories = Math.max(0, finite(context.intakeCalories, 0));
  const proteinTarget = Math.max(0, finite(context.proteinTarget, 0));
  const proteinIntake = Math.max(0, finite(context.proteinIntake, 0));
  const exerciseCalories = Math.max(0, finite(context.exerciseCalories, 0));
  const remainingCalories = Math.max(0, targetCalories - intakeCalories);
  const proteinGap = Math.max(0, Math.round(proteinTarget - proteinIntake));
  const preference = resolvePreference(context);
  const isRemainderPlan = intakeCalories > 0;
  const loggedMeals = new Set(context.loggedMeals);

  let meals: MealPlanMeal[] = ["早餐", "午餐", "晚餐", "點心"];
  if (isRemainderPlan) {
    meals = meals.filter((meal) => !loggedMeals.has(meal));
    if (!meals.length || remainingCalories < 260) meals = ["點心"];
  }

  const planBudget = isRemainderPlan
    ? clamp(remainingCalories || 160, 140, targetCalories)
    : targetCalories;
  const ratioTotal = meals.reduce((sum, meal) => sum + mealRatios[meal], 0);
  const usedNames = new Set<string>();
  const usedSources = new Set<string>();
  const items: MealPlanItem[] = [];

  meals.forEach((meal, index) => {
    const itemTarget =
      meals.length === 1
        ? clamp(planBudget, 100, meal === "點心" ? 300 : 850)
        : (planBudget * mealRatios[meal]) / ratioTotal;
    const food = selectFood(
      meal,
      itemTarget,
      context,
      preference,
      usedNames,
      usedSources,
      index,
    );
    if (!food) return;
    usedNames.add(canonicalName(food.name));
    usedSources.add(food.source);
    items.push({ meal, food });
  });

  const totalKcal = items.reduce((sum, item) => sum + item.food.kcal, 0);
  const totalProtein = items.reduce(
    (sum, item) => sum + item.food.protein,
    0,
  );
  const goalLabel =
    context.goalMode === "cut"
      ? "減脂"
      : context.goalMode === "gain"
        ? "增肌"
        : "維持";
  const title =
    isRemainderPlan && remainingCalories < 260
      ? "接近目標・彈性補充"
      : `${goalLabel}・${preferenceLabel(preference)}`;

  const reasons = [
    isRemainderPlan
      ? `已扣除今天記錄的 ${Math.round(intakeCalories)} kcal`
      : `依每日 ${Math.round(targetCalories)} kcal 目標安排`,
  ];
  if (proteinGap > 0) reasons.push(`優先照顧約 ${proteinGap}g 蛋白質缺口`);
  if (exerciseCalories > 0)
    reasons.push(
      `偵測到 ${Math.round(exerciseCalories)} kcal 運動消耗，優先安排恢復補充`,
    );
  if (remainingCalories < 260 && isRemainderPlan)
    reasons.push("若不餓不必為了湊數進食");

  const tags = [
    isRemainderPlan
      ? `剩餘約 ${Math.round(remainingCalories)} kcal`
      : `整日目標 ${Math.round(targetCalories)} kcal`,
    `蛋白質約 ${Math.round(totalProtein)}g`,
  ];
  if (context.preference === "auto") tags.unshift("依今日狀態自動判斷");
  if (preference === "vegetarian") tags.push("蛋奶素候選");

  return {
    title,
    reason: reasons.join("；"),
    tags,
    items,
    totalKcal: Math.round(totalKcal),
    totalProtein: Math.round(totalProtein),
    candidateCount: getCandidateCount(preference),
    isRemainderPlan,
  };
}
