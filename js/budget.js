const BUDGETS_KEY = "fms.budgets";
const TRANSACTIONS_KEY = "fms.transactions";
const CATEGORY_NAMES = ["Food", "Transport", "Shopping", "Bills", "Education", "Entertainment", "Other"];
const monthInput = document.getElementById("budget-month");
const budgetForm = document.getElementById("budget-form");
const overviewMessage = document.getElementById("budget-message");
const formMessage = document.getElementById("budget-form-message");
const summaryContainer = document.getElementById("budget-summary");
const categoryContainer = document.getElementById("category-spending");
let budgets = {};
let transactions = [];

function currentMonth() {
  const now = new Date();
  return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
}

function formatMoney(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(amount);
}

function readObject(key, label) {
  const saved = localStorage.getItem(key);
  if (saved === null) {
    return {};
  }

  const data = JSON.parse(saved);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Saved " + label + " data is not valid.");
  }
  return data;
}

function readTransactions() {
  const saved = localStorage.getItem(TRANSACTIONS_KEY);
  if (saved === null) {
    return [];
  }

  const data = JSON.parse(saved);
  if (!Array.isArray(data)) {
    throw new Error("Saved transaction data is not a list.");
  }
  return data;
}

function showOverviewMessage(text, isError) {
  overviewMessage.textContent = text;
  overviewMessage.classList.toggle("error", isError);
}

function showFormMessage(text, isError) {
  formMessage.textContent = text;
  formMessage.classList.toggle("error", isError);
}

function getMonthlyExpenses(month) {
  const categoryTotals = new Map();
  let total = 0;

  transactions.forEach(function (transaction) {
    if (!transaction || transaction.type !== "expense") {
      return;
    }

    const date = String(transaction.date || "");
    const amount = Number(transaction.amount);
    if (!date.startsWith(month) || !Number.isFinite(amount) || amount <= 0) {
      return;
    }

    const rawCategory = String(transaction.category || "Uncategorized").trim() || "Uncategorized";
    const presetCategory = CATEGORY_NAMES.find(function (category) {
      return category.toLocaleLowerCase() === rawCategory.toLocaleLowerCase();
    });
    const category = presetCategory || rawCategory;
    const key = category.toLocaleLowerCase();
    const current = categoryTotals.get(key);
    categoryTotals.set(key, {
      name: current ? current.name : category,
      amount: (current ? current.amount : 0) + amount
    });
    total += amount;
  });

  return { total: total, categories: categoryTotals };
}

function makeProgressBar(used, limit, label) {
  const progress = document.createElement("progress");
  progress.className = "budget-progress";
  progress.max = limit > 0 ? limit : 1;
  progress.value = limit > 0 ? Math.min(used, limit) : (used > 0 ? 1 : 0);
  progress.setAttribute("aria-label", label);
  if (limit > 0 && used >= limit) {
    progress.classList.add("exceeded");
  }
  return progress;
}

function makeBudgetSummary(monthBudget, expenses) {
  summaryContainer.replaceChildren();

  if (!monthBudget || !Number.isFinite(Number(monthBudget.total)) || Number(monthBudget.total) <= 0) {
    const message = document.createElement("p");
    message.className = "empty-message";
    message.textContent = "No budget has been created for this month yet. Set one below to start tracking your spending.";
    summaryContainer.append(message);
    return;
  }

  const limit = Number(monthBudget.total);
  const remaining = limit - expenses.total;
  const summary = document.createElement("div");
  summary.className = "budget-total-summary";

  const totals = document.createElement("div");
  totals.className = "budget-total-values";
  [
    ["Monthly budget", formatMoney(limit)],
    ["Spent", formatMoney(expenses.total)],
    [remaining >= 0 ? "Remaining" : "Over budget", formatMoney(Math.abs(remaining))]
  ].forEach(function (item) {
    const value = document.createElement("div");
    value.className = "budget-stat";
    const label = document.createElement("span");
    label.className = "budget-stat-label";
    label.textContent = item[0];
    const amount = document.createElement("strong");
    amount.textContent = item[1];
    value.append(label, amount);
    totals.append(value);
  });

  const progress = makeProgressBar(expenses.total, limit, "Total monthly budget usage");
  const status = document.createElement("p");
  status.className = "budget-usage-note";
  const percentage = Math.round((expenses.total / limit) * 100);
  status.textContent = percentage + "% of your total budget used";
  if (expenses.total >= limit) {
    status.classList.add("budget-warning");
    status.textContent = expenses.total > limit
      ? "Warning: You are over your total budget by " + formatMoney(expenses.total - limit) + "."
      : "Warning: You have reached your total monthly budget.";
  }

  summary.append(totals, progress, status);
  summaryContainer.append(summary);
}

function makeCategoryCard(name, spent, limit) {
  const card = document.createElement("article");
  card.className = "category-budget-card";

  const header = document.createElement("div");
  header.className = "category-budget-header";
  const title = document.createElement("h3");
  title.textContent = name;
  const amount = document.createElement("span");
  amount.textContent = formatMoney(spent);
  header.append(title, amount);
  card.append(header);

  if (limit !== null) {
    card.append(makeProgressBar(spent, limit, name + " budget usage"));
    const note = document.createElement("p");
    note.className = "budget-usage-note";
    if (spent >= limit) {
      note.classList.add("budget-warning");
      note.textContent = spent > limit
        ? "Over limit by " + formatMoney(spent - limit)
        : "Category limit reached.";
    } else {
      note.textContent = formatMoney(limit - spent) + " remaining of " + formatMoney(limit);
    }
    card.append(note);
  } else {
    const note = document.createElement("p");
    note.className = "budget-usage-note";
    note.textContent = "No category limit set";
    card.append(note);
  }

  return card;
}

function renderCategorySpending(monthBudget, expenses) {
  categoryContainer.replaceChildren();
  const heading = document.createElement("h2");
  heading.className = "category-spending-heading";
  heading.textContent = "Category spending";
  categoryContainer.append(heading);

  const limits = monthBudget && monthBudget.categories && typeof monthBudget.categories === "object"
    ? monthBudget.categories
    : {};
  const names = new Map();

  CATEGORY_NAMES.forEach(function (category) {
    names.set(category.toLocaleLowerCase(), category);
  });
  expenses.categories.forEach(function (entry, key) {
    names.set(key, entry.name);
  });

  const grid = document.createElement("div");
  grid.className = "category-budget-grid";
  names.forEach(function (name, key) {
    const spent = expenses.categories.has(key) ? expenses.categories.get(key).amount : 0;
    const budgetName = Object.keys(limits).find(function (category) {
      return category.toLocaleLowerCase() === key;
    });
    const limit = budgetName ? Number(limits[budgetName]) : null;
    grid.append(makeCategoryCard(name, spent, Number.isFinite(limit) && limit >= 0 ? limit : null));
  });
  categoryContainer.append(grid);
}

function render() {
  const month = monthInput.value;
  if (!month) {
    return;
  }

  const expenses = getMonthlyExpenses(month);
  const monthBudget = budgets[month];
  makeBudgetSummary(monthBudget, expenses);
  renderCategorySpending(monthBudget, expenses);
}

function loadBudgetIntoForm() {
  const budget = budgets[monthInput.value];
  budgetForm.elements.total.value = budget && budget.total ? budget.total : "";

  CATEGORY_NAMES.forEach(function (category) {
    const input = budgetForm.elements[category];
    const limit = budget && budget.categories ? budget.categories[category] : "";
    input.value = limit === "" || limit === undefined || limit === null ? "" : limit;
  });
  showFormMessage("", false);
  render();
}

function setupMenu() {
  const sidebar = document.getElementById("sidebar");
  const button = document.getElementById("menu-button");
  const backdrop = document.getElementById("sidebar-backdrop");

  function closeMenu() {
    sidebar.classList.remove("open");
    button.setAttribute("aria-expanded", "false");
    backdrop.hidden = true;
  }

  button.addEventListener("click", function () {
    const isOpen = sidebar.classList.toggle("open");
    button.setAttribute("aria-expanded", String(isOpen));
    backdrop.hidden = !isOpen;
  });

  backdrop.addEventListener("click", closeMenu);
}

monthInput.value = currentMonth();
monthInput.addEventListener("change", loadBudgetIntoForm);

budgetForm.addEventListener("input", function () {
  showFormMessage("", false);
});

budgetForm.addEventListener("submit", function (event) {
  event.preventDefault();
  const total = Number(budgetForm.elements.total.value);
  if (!Number.isFinite(total) || total <= 0 || !budgetForm.checkValidity()) {
    budgetForm.reportValidity();
    return;
  }

  const categories = {};
  CATEGORY_NAMES.forEach(function (category) {
    const value = budgetForm.elements[category].value;
    if (value !== "") {
      categories[category] = Number(value);
    }
  });

  const previousBudget = budgets[monthInput.value];
  budgets[monthInput.value] = { total: total, categories: categories };
  try {
    localStorage.setItem(BUDGETS_KEY, JSON.stringify(budgets));
    showFormMessage("Budget saved for this month.", false);
    render();
  } catch (error) {
    if (previousBudget) {
      budgets[monthInput.value] = previousBudget;
    } else {
      delete budgets[monthInput.value];
    }
    showFormMessage("Unable to save the budget. Check browser storage and try again.", true);
  }
});

window.addEventListener("storage", function (event) {
  if (event.key !== BUDGETS_KEY && event.key !== TRANSACTIONS_KEY && event.key !== null) {
    return;
  }

  try {
    if (event.key === BUDGETS_KEY || event.key === null) {
      budgets = readObject(BUDGETS_KEY, "budget");
      loadBudgetIntoForm();
    }
    if (event.key === TRANSACTIONS_KEY || event.key === null) {
      transactions = readTransactions();
      render();
    }
    showOverviewMessage("", false);
  } catch (error) {
    showOverviewMessage("Saved data could not be read. Check the browser storage data.", true);
  }
});

try {
  budgets = readObject(BUDGETS_KEY, "budget");
  transactions = readTransactions();
  loadBudgetIntoForm();
} catch (error) {
  showOverviewMessage("Saved data could not be read. Check the browser storage data.", true);
}

setupMenu();
