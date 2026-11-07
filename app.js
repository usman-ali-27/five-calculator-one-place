const generalKeys = [
  ["C", "danger"],
  ["±", "op"],
  ["%", "op"],
  ["÷", "op"],
  ["7", ""],
  ["8", ""],
  ["9", ""],
  ["×", "op"],
  ["4", ""],
  ["5", ""],
  ["6", ""],
  ["−", "op"],
  ["1", ""],
  ["2", ""],
  ["3", ""],
  ["+", "op"],
  ["0", "wide"],
  [".", ""],
  ["=", "accent"],
];

const scientificKeys = [
  ["sin", "fn"],
  ["cos", "fn"],
  ["tan", "fn"],
  ["ln", "fn"],
  ["log", "fn"],
  ["π", "fn"],
  ["√", "fn"],
  ["x²", "fn"],
  ["xʸ", "op"],
  ["n!", "fn"],
  ["e", "fn"],
  ["(", "op"],
  ["7", ""],
  ["8", ""],
  ["9", ""],
  ["÷", "op"],
  [")", "op"],
  ["C", "danger"],
  ["4", ""],
  ["5", ""],
  ["6", ""],
  ["×", "op"],
  ["%", "op"],
  ["⌫", "danger"],
  ["1", ""],
  ["2", ""],
  ["3", ""],
  ["−", "op"],
  ["±", "op"],
  ["=", "accent"],
  ["0", "wide"],
  [".", ""],
  ["+", "op"],
];

function renderKeys(root, keys) {
  root.innerHTML = keys
    .map(
      ([label, cls]) =>
        `<button class="key ${cls}" type="button" data-key="${label}">${label}</button>`
    )
    .join("");
}

renderKeys(document.getElementById("general-keys"), generalKeys);
renderKeys(document.getElementById("scientific-keys"), scientificKeys);

const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((item) => item.classList.toggle("is-active", item === tab));
    panels.forEach((panel) => {
      const on = panel.dataset.panel === tab.dataset.tab;
      panel.classList.toggle("is-active", on);
      panel.hidden = !on;
    });
  });
});

function formatNumber(value) {
  if (!Number.isFinite(value)) return "Error";
  const abs = Math.abs(value);
  if (abs !== 0 && (abs >= 1e10 || abs < 1e-8)) return value.toExponential(6);
  return Number(value.toPrecision(12)).toString();
}

function factorial(n) {
  if (n < 0 || !Number.isInteger(n) || n > 170) return NaN;
  let result = 1;
  for (let i = 2; i <= n; i += 1) result *= i;
  return result;
}

function tokenize(input) {
  const src = input
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/π/g, " pi ")
    .replace(/\be\b/g, " e ")
    .replace(/√/g, " sqrt ")
    .replace(/\^/g, " ^ ");
  const tokens = [];
  const re =
    /\s*(pi|e|sqrt|sin|cos|tan|ln|log|fact|%|[+\-*/^()]|\d*\.\d+|\d+)\s*/gy;
  let lastIndex = 0;
  while (lastIndex < src.length) {
    re.lastIndex = lastIndex;
    const match = re.exec(src);
    if (!match || match.index !== lastIndex) return null;
    tokens.push(match[1]);
    lastIndex = re.lastIndex;
    if (!match[0]) break;
  }
  return tokens;
}

function toRpn(tokens, angleMode) {
  const output = [];
  const ops = [];
  const prec = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 3, "%": 4 };
  const right = { "^": true };
  const fns = new Set(["sin", "cos", "tan", "ln", "log", "sqrt", "fact"]);
  let prev = null;

  for (const raw of tokens) {
    let token = raw;
    if (token === "-" && (prev == null || ["+", "-", "*", "/", "^", "("].includes(prev))) {
      token = "u-";
    }
    if (!Number.isNaN(Number(token))) {
      output.push(Number(token));
    } else if (token === "pi") {
      output.push(Math.PI);
    } else if (token === "e") {
      output.push(Math.E);
    } else if (fns.has(token) || token === "u-") {
      ops.push(token);
    } else if (token === "(") {
      ops.push(token);
    } else if (token === ")") {
      while (ops.length && ops[ops.length - 1] !== "(") output.push(ops.pop());
      if (!ops.length) return null;
      ops.pop();
      if (fns.has(ops[ops.length - 1]) || ops[ops.length - 1] === "u-") {
        output.push(ops.pop());
      }
    } else if (token in prec) {
      while (
        ops.length &&
        ops[ops.length - 1] in prec &&
        (right[token]
          ? prec[ops[ops.length - 1]] > prec[token]
          : prec[ops[ops.length - 1]] >= prec[token])
      ) {
        output.push(ops.pop());
      }
      ops.push(token);
    } else {
      return null;
    }
    prev = token === "u-" ? "-" : raw;
  }
  while (ops.length) {
    const op = ops.pop();
    if (op === "(" || op === ")") return null;
    output.push(op);
  }
  return { output, angleMode };
}

function evalRpn({ output, angleMode }) {
  const stack = [];
  const toRad = (value) => (angleMode === "DEG" ? (value * Math.PI) / 180 : value);
  for (const token of output) {
    if (typeof token === "number") {
      stack.push(token);
      continue;
    }
    if (token === "u-") {
      stack.push(-stack.pop());
      continue;
    }
    if (["sin", "cos", "tan", "ln", "log", "sqrt", "fact", "%"].includes(token)) {
      const a = stack.pop();
      const map = {
        sin: Math.sin(toRad(a)),
        cos: Math.cos(toRad(a)),
        tan: Math.tan(toRad(a)),
        ln: Math.log(a),
        log: Math.log10(a),
        sqrt: Math.sqrt(a),
        fact: factorial(a),
        "%": a / 100,
      };
      stack.push(map[token]);
      continue;
    }
    const b = stack.pop();
    const a = stack.pop();
    const map = {
      "+": a + b,
      "-": a - b,
      "*": a * b,
      "/": a / b,
      "^": a ** b,
    };
    stack.push(map[token]);
  }
  return stack.length === 1 ? stack[0] : NaN;
}

function closeParens(expr) {
  const open = (expr.match(/\(/g) || []).length;
  const close = (expr.match(/\)/g) || []).length;
  return expr + ")".repeat(Math.max(0, open - close));
}

function evaluate(expr, angleMode = "DEG") {
  if (!expr.trim()) return 0;
  const tokens = tokenize(closeParens(expr));
  if (!tokens) return NaN;
  const rpn = toRpn(tokens, angleMode);
  if (!rpn) return NaN;
  return evalRpn(rpn);
}

function createCalc(exprEl, resultEl, angleModeEl) {
  let expr = "";
  let lastExpr = "";
  let overwrite = false;

  const paint = (value) => {
    exprEl.textContent = lastExpr;
    resultEl.textContent = value ?? (expr || "0");
  };

  const apply = (key) => {
    if (key === "C") {
      expr = "";
      lastExpr = "";
      overwrite = false;
      paint("0");
      return;
    }
    if (key === "⌫") {
      expr = expr.slice(0, -1);
      overwrite = false;
      paint();
      return;
    }
    if (key === "=") {
      const value = evaluate(expr, angleModeEl?.textContent.trim() || "DEG");
      lastExpr = expr;
      const shown = formatNumber(value);
      expr = Number.isFinite(value) ? String(value) : "";
      overwrite = true;
      paint(shown);
      return;
    }
    if (key === "±") {
      if (!expr) return;
      const value = evaluate(expr, angleModeEl?.textContent.trim() || "DEG");
      if (!Number.isFinite(value)) return;
      expr = String(-value);
      lastExpr = "";
      overwrite = true;
      paint(formatNumber(-value));
      return;
    }

    const map = {
      "x²": "^2",
      "xʸ": "^",
      "n!": "fact(",
      "√": "sqrt(",
      sin: "sin(",
      cos: "cos(",
      tan: "tan(",
      ln: "ln(",
      log: "log(",
      π: "π",
      e: "e",
    };

    if (overwrite && /[0-9.]/.test(key)) expr = "";
    overwrite = false;
    expr += map[key] || key;
    lastExpr = "";
    paint();
  };

  return { apply };
}

const general = createCalc(
  document.getElementById("gen-expr"),
  document.getElementById("gen-result")
);
const scientific = createCalc(
  document.getElementById("sci-expr"),
  document.getElementById("sci-result"),
  document.getElementById("angle-mode")
);

document.getElementById("general-keys").addEventListener("click", (event) => {
  const key = event.target.dataset.key;
  if (key) general.apply(key);
});

document.getElementById("scientific-keys").addEventListener("click", (event) => {
  const key = event.target.dataset.key;
  if (key) scientific.apply(key);
});

document.getElementById("angle-mode").addEventListener("click", (event) => {
  event.currentTarget.textContent =
    event.currentTarget.textContent === "DEG" ? "RAD" : "DEG";
  event.currentTarget.setAttribute(
    "aria-pressed",
    event.currentTarget.textContent === "DEG" ? "true" : "false"
  );
});

function bmiCategory(bmi) {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

document.getElementById("bmi-form").addEventListener("submit", (event) => {
  event.preventDefault();
  let height = Number(document.getElementById("bmi-height").value);
  let weight = Number(document.getElementById("bmi-weight").value);
  if (document.getElementById("bmi-height-unit").value === "in") height *= 2.54;
  if (document.getElementById("bmi-weight-unit").value === "lb") weight *= 0.453592;
  const meters = height / 100;
  const bmi = weight / (meters * meters);
  document.getElementById("bmi-value").textContent = bmi.toFixed(1);
  document.getElementById("bmi-label").textContent = bmiCategory(bmi);
  const clamped = Math.min(40, Math.max(10, bmi));
  document.getElementById("bmi-marker").style.left = `${((clamped - 10) / 30) * 100}%`;
});

function monthDiffSafe(from, to) {
  let years = to.getFullYear() - from.getFullYear();
  let months = to.getMonth() - from.getMonth();
  let days = to.getDate() - from.getDate();
  if (days < 0) {
    months -= 1;
    const prev = new Date(to.getFullYear(), to.getMonth(), 0).getDate();
    days += prev;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days };
}

const dob = document.getElementById("age-dob");
const asOf = document.getElementById("age-asof");
const today = new Date();
asOf.value = today.toISOString().slice(0, 10);
dob.value = new Date(today.getFullYear() - 25, today.getMonth(), today.getDate())
  .toISOString()
  .slice(0, 10);

document.getElementById("age-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const birth = new Date(`${dob.value}T00:00:00`);
  const now = new Date(`${asOf.value}T00:00:00`);
  if (now < birth) {
    document.getElementById("age-y").textContent = "—";
    document.getElementById("age-m").textContent = "—";
    document.getElementById("age-d").textContent = "—";
    document.getElementById("age-next").textContent = "Choose a later date";
    return;
  }
  const age = monthDiffSafe(birth, now);
  document.getElementById("age-y").textContent = age.years;
  document.getElementById("age-m").textContent = age.months;
  document.getElementById("age-d").textContent = age.days;
  const next = new Date(now.getFullYear(), birth.getMonth(), birth.getDate());
  if (next <= now) next.setFullYear(now.getFullYear() + 1);
  const wait = monthDiffSafe(now, next);
  document.getElementById("age-next").textContent = `${wait.months} mo ${wait.days} d`;
});

function money(value) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
}

document.getElementById("loan-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const principal = Number(document.getElementById("loan-principal").value);
  const annual = Number(document.getElementById("loan-rate").value) / 100;
  let months = Number(document.getElementById("loan-tenure").value);
  if (document.getElementById("loan-tenure-unit").value === "years") months *= 12;
  const r = annual / 12;
  const emi =
    r === 0 ? principal / months : (principal * r * (1 + r) ** months) / ((1 + r) ** months - 1);
  const total = emi * months;
  const interest = total - principal;
  document.getElementById("loan-emi").textContent = money(emi);
  document.getElementById("loan-interest").textContent = money(interest);
  document.getElementById("loan-total").textContent = money(total);
  const share = Math.max(0, Math.min(100, (principal / total) * 100));
  document.getElementById("loan-principal-bar").style.width = `${share}%`;
});
