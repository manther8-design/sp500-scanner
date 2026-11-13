import { evaluateFormula, validateFormula, testFormula } from "./formula-engine";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const hourRateCase = evaluateFormula("round((ot_base / monthly_hours) * ot_hours * ot_factor, 2)", {
  ot_base: 10000,
  monthly_hours: 176,
  ot_hours: 3,
  ot_factor: 1.5,
});
assert(Math.abs(hourRateCase - 255.68) < 0.02, `OT expected ~255.68 got ${hourRateCase}`);

const lateBoost = evaluateFormula(
  "round((basic_salary / monthly_hours) * late_hours * IF(late_hours > 2, 1.1, 1), 2)",
  { basic_salary: 8000, monthly_hours: 176, late_hours: 3 },
);
assert(lateBoost > evaluateFormula(
  "round((basic_salary / monthly_hours) * late_hours * IF(late_hours > 2, 1.1, 1), 2)",
  { basic_salary: 8000, monthly_hours: 176, late_hours: 1 },
), "late > 2 should cost more per relative check");

assert(validateFormula("basic_salary / month_days * absent_days").ok, "valid formula");
assert(!validateFormula("evil()").ok, "invalid fn rejected");
assert(!validateFormula("require('fs')").ok, "code injection rejected");

const t = testFormula("MIN(100, MAX(10, fixed_value))", { fixed_value: 50 });
assert(t.rounded === 50, "min/max");

console.log("formula-engine tests passed");
