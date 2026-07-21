import assert from "node:assert/strict";
import test from "node:test";
import { calculateEnergyTotals, type EnergyProfile } from "../app/domain";
import {
  composeProfileWeight,
  PROFILE_AGE_OPTIONS,
  PROFILE_HEIGHT_OPTIONS,
  PROFILE_WEIGHT_WHOLE_OPTIONS,
  splitProfileWeight,
} from "../app/profile-controls";

const scenarios: Array<{ name: string; profile: EnergyProfile }> = [
  {
    name: "嬌小女性減脂",
    profile: {
      sex: "female",
      age: 29,
      height: 158,
      weight: 52.4,
      target: 48,
      activity: 1.25,
      goalMode: "cut",
    },
  },
  {
    name: "高個男性維持",
    profile: {
      sex: "male",
      age: 36,
      height: 190,
      weight: 88.6,
      target: 88.6,
      activity: 1.35,
      goalMode: "maintain",
    },
  },
  {
    name: "高體重男性減脂",
    profile: {
      sex: "male",
      age: 42,
      height: 175,
      weight: 145.8,
      target: 120,
      activity: 1.2,
      goalMode: "cut",
    },
  },
  {
    name: "偏瘦女性增重",
    profile: {
      sex: "female",
      age: 24,
      height: 165,
      weight: 45.2,
      target: 52,
      activity: 1.35,
      goalMode: "gain",
    },
  },
  {
    name: "高齡女性維持",
    profile: {
      sex: "female",
      age: 72,
      height: 155,
      weight: 61.3,
      target: 61.3,
      activity: 1.2,
      goalMode: "maintain",
    },
  },
];

test("mobile profile pickers accept diverse real-world user scenarios", () => {
  for (const { name, profile } of scenarios) {
    assert.ok(PROFILE_AGE_OPTIONS.includes(profile.age), `${name}: 年齡可選`);
    assert.ok(
      PROFILE_HEIGHT_OPTIONS.includes(profile.height),
      `${name}: 身高可選`,
    );

    for (const value of [profile.weight, profile.target]) {
      const parts = splitProfileWeight(value);
      assert.ok(
        PROFILE_WEIGHT_WHOLE_OPTIONS.includes(parts.whole),
        `${name}: 體重整數可選`,
      );
      assert.equal(
        composeProfileWeight(parts.whole, parts.tenth),
        value,
        `${name}: 體重不應因下拉選單失真`,
      );
    }
  }
});

test("diverse profiles always produce finite and sex-safe calorie targets", () => {
  for (const { name, profile } of scenarios) {
    const totals = calculateEnergyTotals(profile, [], []);
    const floor = profile.sex === "male" ? 1500 : 1200;
    assert.ok(Number.isFinite(totals.bmr), `${name}: BMR 有效`);
    assert.ok(Number.isFinite(totals.targetCalories), `${name}: 熱量有效`);
    assert.ok(totals.targetCalories >= floor, `${name}: 不低於安全下限`);
    assert.ok(totals.proteinTarget > 0, `${name}: 蛋白質目標有效`);
  }
});
