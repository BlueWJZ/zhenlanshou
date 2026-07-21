import assert from "node:assert/strict";
import test from "node:test";
import {
  composeProfileWeight,
  PROFILE_AGE_OPTIONS,
  PROFILE_HEIGHT_OPTIONS,
  PROFILE_WEIGHT_WHOLE_OPTIONS,
  splitProfileWeight,
} from "../app/profile-controls";

test("profile selectors cover supported ages, heights and weights", () => {
  assert.deepEqual(
    [PROFILE_AGE_OPTIONS[0], PROFILE_AGE_OPTIONS.at(-1)],
    [18, 100],
  );
  assert.deepEqual(
    [PROFILE_HEIGHT_OPTIONS[0], PROFILE_HEIGHT_OPTIONS.at(-1)],
    [120, 230],
  );
  assert.deepEqual(
    [PROFILE_WEIGHT_WHOLE_OPTIONS[0], PROFILE_WEIGHT_WHOLE_OPTIONS.at(-1)],
    [20, 400],
  );
});

test("weight picker preserves one-decimal values for diverse users", () => {
  [45.2, 52.4, 70, 120.5, 199.9, 400].forEach((weight) => {
    const parts = splitProfileWeight(weight);
    assert.equal(composeProfileWeight(parts.whole, parts.tenth), weight);
  });
});

test("weight picker safely normalizes invalid and edge values", () => {
  assert.deepEqual(splitProfileWeight(Number.NaN), { whole: 70, tenth: 0 });
  assert.equal(composeProfileWeight(400, 9), 400);
  assert.equal(composeProfileWeight(10, -4), 20);
});
