/**
 * Universal Formula Engine — safe DSL (no arbitrary code).
 * Supports + - * / % () comparisons, IF/MIN/MAX/ROUND/ABS.
 * Historical payroll stores FormulaSnapshot so edits don't rewrite past runs.
 */

export type FormulaContext = Record<string, number>;

export const ALLOWED_VARS = [
  "basic_salary",
  "total_salary",
  "gross_salary",
  "housing_allowance",
  "transport_allowance",
  "ot_base",
  "monthly_hours",
  "daily_hours",
  "working_days",
  "month_days",
  "absent_days",
  "absent_hours",
  "late_hours",
  "late_minutes",
  "early_leave_hours",
  "ot_hours",
  "ot_factor",
  "deduction_value",
  "deduction_percent",
  "hour_rate",
  "day_rate",
  "service_years",
  "service_months",
  "leave_days",
  "sales_amount",
  "profit_amount",
  "kpi_score",
  "fixed_value",
  "percent",
  "min_value",
  "max_value",
  "gosi_employee_rate",
  "gosi_employer_rate",
] as const;

const ALLOWED_SET = new Set<string>(ALLOWED_VARS);

type Token =
  | { type: "num"; value: number }
  | { type: "id"; value: string }
  | { type: "op"; value: string }
  | { type: "paren"; value: "(" | ")" }
  | { type: "comma" };

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = expr.trim();
  while (i < s.length) {
    const ch = s[i];
    if (ch === " " || ch === "\t" || ch === "\n") {
      i++;
      continue;
    }
    if (ch === ",") {
      tokens.push({ type: "comma" });
      i++;
      continue;
    }
    if (ch === "(" || ch === ")") {
      tokens.push({ type: "paren", value: ch });
      i++;
      continue;
    }
    if ("+-*/%<>=!".includes(ch)) {
      let op = ch;
      if ((ch === "<" || ch === ">" || ch === "=" || ch === "!") && s[i + 1] === "=") {
        op += "=";
        i++;
      }
      tokens.push({ type: "op", value: op });
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let num = "";
      while (i < s.length && /[0-9.]/.test(s[i])) num += s[i++];
      tokens.push({ type: "num", value: parseFloat(num) });
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let id = "";
      while (i < s.length && /[a-zA-Z0-9_]/.test(s[i])) id += s[i++];
      tokens.push({ type: "id", value: id.toLowerCase() });
      continue;
    }
    throw new Error(`رمز غير مسموح في المعادلة: ${ch}`);
  }
  return tokens;
}

function evalTokens(tokens: Token[], ctx: FormulaContext): number {
  let i = 0;
  const peek = () => tokens[i];
  const consume = () => tokens[i++];
  const matchOp = (...ops: string[]) => {
    const t = peek();
    if (t?.type === "op" && ops.includes(t.value)) {
      consume();
      return t.value;
    }
    return null;
  };

  function parseComparison(): number {
    const left = parseAdd();
    const t = peek();
    if (t?.type === "op" && ["<", ">", "<=", ">=", "==", "!="].includes(t.value)) {
      consume();
      const right = parseAdd();
      switch (t.value) {
        case "<":
          return left < right ? 1 : 0;
        case ">":
          return left > right ? 1 : 0;
        case "<=":
          return left <= right ? 1 : 0;
        case ">=":
          return left >= right ? 1 : 0;
        case "==":
          return left === right ? 1 : 0;
        case "!=":
          return left !== right ? 1 : 0;
      }
    }
    return left;
  }

  function parseAdd(): number {
    let left = parseMul();
    let op: string | null;
    while ((op = matchOp("+", "-"))) {
      const right = parseMul();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  function parseMul(): number {
    let left = parseUnary();
    let op: string | null;
    while ((op = matchOp("*", "/", "%"))) {
      const right = parseUnary();
      if (op === "*") left *= right;
      else if (op === "%") left %= right;
      else {
        if (right === 0) throw new Error("قسمة على صفر");
        left /= right;
      }
    }
    return left;
  }

  function parseUnary(): number {
    if (matchOp("-")) return -parseUnary();
    if (matchOp("+")) return parseUnary();
    return parsePrimary();
  }

  function parsePrimary(): number {
    const t = consume();
    if (!t) throw new Error("معادلة فارغة");
    if (t.type === "num") return t.value;
    if (t.type === "paren" && t.value === "(") {
      const v = parseComparison();
      const c = consume();
      if (c?.type !== "paren" || c.value !== ")") throw new Error("قوس غير مغلق");
      return v;
    }
    if (t.type === "id") {
      if (peek()?.type === "paren" && (peek() as { value?: string }).value === "(") return parseFn(t.value);
      if (!(t.value in ctx) && !ALLOWED_SET.has(t.value)) {
        throw new Error(`متغير غير مسموح: ${t.value}`);
      }
      return Number(ctx[t.value] ?? 0);
    }
    throw new Error("تعبير غير صالح");
  }

  function parseFn(name: string): number {
    consume();
    const args: number[] = [];
    if (!(peek()?.type === "paren" && (peek() as { value?: string }).value === ")")) {
      args.push(parseComparison());
      while (peek()?.type === "comma") {
        consume();
        args.push(parseComparison());
      }
    }
    const c = consume();
    if (c?.type !== "paren" || (c as { value?: string }).value !== ")") throw new Error("قوس دالة غير مغلق");
    switch (name) {
      case "if":
        if (args.length !== 3) throw new Error("IF يحتاج 3 وسائط");
        return args[0] ? args[1] : args[2];
      case "min":
        return Math.min(...args);
      case "max":
        return Math.max(...args);
      case "abs":
        return Math.abs(args[0] ?? 0);
      case "round": {
        const p = args[1] ?? 0;
        const m = Math.pow(10, p);
        return Math.round((args[0] ?? 0) * m) / m;
      }
      default:
        throw new Error(`دالة غير مدعومة: ${name}`);
    }
  }

  const result = parseComparison();
  if (i < tokens.length) throw new Error("معادلة تحتوي على رموز زائدة");
  return result;
}

export function evaluateFormula(expression: string, context: FormulaContext = {}): number {
  if (!expression?.trim()) throw new Error("المعادلة فارغة");
  if (/[`$'";{}]|import|require|function|=>|eval|process|global/i.test(expression)) {
    throw new Error("المعادلة تحتوي على عناصر غير مسموحة");
  }
  return evalTokens(tokenize(expression), context);
}

export function validateFormula(expression: string): { ok: boolean; error?: string } {
  try {
    const sample = Object.fromEntries(ALLOWED_VARS.map((v) => [v, 1]));
    evaluateFormula(expression, sample);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "خطأ" };
  }
}

export function testFormula(expression: string, context: FormulaContext) {
  const value = evaluateFormula(expression, context);
  return { value, rounded: Math.round((value + Number.EPSILON) * 100) / 100 };
}
