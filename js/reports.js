const TRANSACTIONS_KEY = "fms.transactions";
const BUDGETS_KEY = "fms.budgets";
const SAVINGS_KEY = "fms.savingsGoals";
const periodInput = document.getElementById("report-period");
const reportsMessage = document.getElementById("reports-message");
const emptyMessage = document.getElementById("reports-empty");
const chartMessage = document.getElementById("chart-message");
const categoryTableBody = document.getElementById("category-table-body");
const monthlyTableBody = document.getElementById("monthly-table-body");
const budgetReportList = document.getElementById("budget-report-list");
const savingsReportList = document.getElementById("report-savings-list");
let transactions = [];
let budgets = {};
let savingsGoals = [];
let incomeExpenseChart = null;
let categoryExpenseChart = null;

function formatMoney(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(amount);
}

function readArray(key, label) {
  const saved = localStorage.getItem(key);
  if (saved === null) {
    return [];
  }
  const data = JSON.parse(saved);
  if (!Array.isArray(data)) {
    throw new Error("Saved " + label + " data is not a list.");
  }
  return data;
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

function monthKey(dateValue) {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(String(dateValue || ""));
  if (!match) {
    return null;
  }
  const month = Number(match[2]);
  const date = new Date(Number(match[1]), month - 1, Number(String(dateValue).slice(-2)));
  return month >= 1 && month <= 12 && date.getFullYear() === Number(match[1]) &&
    date.getMonth() === month - 1 && date.getDate() === Number(String(dateValue).slice(-2))
    ? match[1] + "-" + match[2]
    : null;
}

function periodMonths(period) {
  const now = new Date();
  const thisMonth = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  if (period === "this-month") {
    return [thisMonth];
  }
  if (period === "last-month") {
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return [last.getFullYear() + "-" + String(last.getMonth() + 1).padStart(2, "0")];
  }
  if (period === "this-year") {
    return Array.from({ length: 12 }, function (_, index) {
      return now.getFullYear() + "-" + String(index + 1).padStart(2, "0");
    });
  }

  const months = new Set();
  transactions.forEach(function (transaction) {
    const key = transaction && monthKey(transaction.date);
    if (key) {
      months.add(key);
    }
  });
  Object.keys(budgets).forEach(function (key) {
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(key)) {
      months.add(key);
    }
  });
  return Array.from(months).sort();
}

function filterTransactions(period) {
  const months = new Set(periodMonths(period));
  return transactions.filter(function (transaction) {
    return transaction && months.has(monthKey(transaction.date));
  });
}

function summarizeTransactions(selectedTransactions) {
  const monthly = new Map();
  const categories = new Map();
  let income = 0;
  let expenses = 0;

  selectedTransactions.forEach(function (transaction) {
    const amount = Number(transaction.amount);
    const key = monthKey(transaction.date);
    if (!key || !Number.isFinite(amount) || amount <= 0) {
      return;
    }

    if (!monthly.has(key)) {
      monthly.set(key, { income: 0, expenses: 0 });
    }
    const month = monthly.get(key);
    if (transaction.type === "income") {
      income += amount;
      month.income += amount;
    } else if (transaction.type === "expense") {
      expenses += amount;
      month.expenses += amount;
      const categoryName = String(transaction.category || "Uncategorized").trim() || "Uncategorized";
      const categoryKey = categoryName.toLocaleLowerCase();
      const category = categories.get(categoryKey);
      categories.set(categoryKey, {
        name: category ? category.name : categoryName,
        amount: (category ? category.amount : 0) + amount
      });
    }
  });

  return {
    income: income,
    expenses: expenses,
    monthly: monthly,
    categories: Array.from(categories.values()).sort(function (a, b) {
      return b.amount - a.amount;
    })
  };
}

function monthLabel(key) {
  const parts = key.split("-");
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function validContributions(goal) {
  return (Array.isArray(goal.contributions) ? goal.contributions : []).filter(function (contribution) {
    const amount = Number(contribution && contribution.amount);
    return contribution && Number.isFinite(amount) && amount > 0 && monthKey(contribution.date);
  });
}

function savingsOpeningAmount(goal, contributions) {
  const openingAmount = Number(goal.openingAmount);
  if (goal.openingAmount !== undefined && Number.isFinite(openingAmount) && openingAmount >= 0) {
    return openingAmount;
  }
  const currentAmount = Number(goal.currentAmount);
  const historyTotal = contributions.reduce(function (total, contribution) {
    return total + Number(contribution.amount);
  }, 0);
  return Math.max(0, (Number.isFinite(currentAmount) && currentAmount >= 0 ? currentAmount : historyTotal) - historyTotal);
}

function goalSavedAmount(goal) {
  const contributions = validContributions(goal);
  return savingsOpeningAmount(goal, contributions) + contributions.reduce(function (total, contribution) {
    return total + Number(contribution.amount);
  }, 0);
}

function isContributionInPeriod(date, period) {
  const key = monthKey(date);
  if (!key) {
    return false;
  }
  if (period === "all-time") {
    return true;
  }
  if (period === "this-year") {
    return key.slice(0, 4) === String(new Date().getFullYear());
  }
  return key === periodMonths(period)[0];
}

function currentSavingsTotal(period) {
  return savingsGoals.reduce(function (total, goal) {
    if (!goal || typeof goal !== "object") {
      return total;
    }
    const contributions = validContributions(goal);
    const periodTotal = contributions.reduce(function (sum, contribution) {
      return isContributionInPeriod(contribution.date, period) ? sum + Number(contribution.amount) : sum;
    }, 0);
    const openingAmount = period === "all-time" ? savingsOpeningAmount(goal, contributions) : 0;
    return total + openingAmount + periodTotal;
  }, 0);
}

function setSummary(summary, period) {
  document.getElementById("report-income").textContent = formatMoney(summary.income);
  document.getElementById("report-expenses").textContent = formatMoney(summary.expenses);
  document.getElementById("report-savings").textContent = formatMoney(currentSavingsTotal(period));
  document.getElementById("report-balance").textContent = formatMoney(summary.income - summary.expenses);
}

function drawCharts(summary, months) {
  if (typeof Chart === "undefined") {
    chartMessage.textContent = "Charts could not load. Check your internet connection and reload the page.";
    return;
  }
  chartMessage.textContent = "";

  const labels = months.map(monthLabel);
  const incomeData = months.map(function (month) {
    return summary.monthly.has(month) ? summary.monthly.get(month).income : 0;
  });
  const expenseData = months.map(function (month) {
    return summary.monthly.has(month) ? summary.monthly.get(month).expenses : 0;
  });

  if (incomeExpenseChart) {
    incomeExpenseChart.data.labels = labels;
    incomeExpenseChart.data.datasets[0].data = incomeData;
    incomeExpenseChart.data.datasets[1].data = expenseData;
    incomeExpenseChart.update();
  } else {
    incomeExpenseChart = new Chart(document.getElementById("income-expense-chart"), {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          { label: "Income", data: incomeData, backgroundColor: "#d4c6ef", borderRadius: 8 },
          { label: "Expenses", data: expenseData, backgroundColor: "#7b68b0", borderRadius: 8 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  const categoryLabels = summary.categories.map(function (category) { return category.name; });
  const categoryData = summary.categories.map(function (category) { return category.amount; });
  const colors = ["#7b68b0", "#b9a8df", "#d4c6ef", "#9d8bc8", "#e7dff6", "#6a589e", "#c5b8e4"];
  const categoryColors = categoryData.map(function (_, index) {
    return colors[index % colors.length];
  });
  if (categoryExpenseChart) {
    categoryExpenseChart.data.labels = categoryLabels.length ? categoryLabels : ["No expenses"];
    categoryExpenseChart.data.datasets[0].data = categoryData.length ? categoryData : [0];
    categoryExpenseChart.data.datasets[0].backgroundColor = categoryData.length ? categoryColors : [colors[0]];
    categoryExpenseChart.update();
  } else {
    categoryExpenseChart = new Chart(document.getElementById("category-expense-chart"), {
      type: "doughnut",
      data: {
        labels: categoryLabels.length ? categoryLabels : ["No expenses"],
        datasets: [{
          data: categoryData.length ? categoryData : [0],
          backgroundColor: categoryData.length ? categoryColors : [colors[0]],
          borderColor: "#ffffff",
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } }
      }
    });
  }
}

function renderCategoryTable(categories) {
  categoryTableBody.replaceChildren();
  if (categories.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 2;
    cell.textContent = "No expenses in this period.";
    row.append(cell);
    categoryTableBody.append(row);
    return;
  }

  categories.forEach(function (category) {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    nameCell.textContent = category.name;
    const amountCell = document.createElement("td");
    amountCell.textContent = formatMoney(category.amount);
    row.append(nameCell, amountCell);
    categoryTableBody.append(row);
  });
}

function renderMonthlyTable(summary, months) {
  monthlyTableBody.replaceChildren();
  const populatedMonths = months.filter(function (month) {
    return summary.monthly.has(month);
  });
  if (populatedMonths.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.textContent = "No monthly transaction totals to display.";
    row.append(cell);
    monthlyTableBody.append(row);
    return;
  }

  populatedMonths.forEach(function (key) {
    const totals = summary.monthly.get(key);
    const row = document.createElement("tr");
    [monthLabel(key), formatMoney(totals.income), formatMoney(totals.expenses)].forEach(function (value) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    });
    monthlyTableBody.append(row);
  });
}

function createProgress(used, target, label, className) {
  const progress = document.createElement("progress");
  progress.className = className;
  progress.max = target > 0 ? target : 1;
  progress.value = target > 0 ? Math.min(used, target) : 0;
  progress.setAttribute("aria-label", label);
  if (target > 0 && used >= target) {
    progress.classList.add("exceeded");
  }
  return progress;
}

function renderBudgets(months, summary) {
  budgetReportList.replaceChildren();
  const budgetMonths = months.filter(function (month) {
    const budget = budgets[month];
    return budget && Number.isFinite(Number(budget.total)) && Number(budget.total) > 0;
  });
  if (budgetMonths.length === 0) {
    const message = document.createElement("p");
    message.className = "empty-message";
    message.textContent = "No saved budgets are available for this report period.";
    budgetReportList.append(message);
    return;
  }

  budgetMonths.forEach(function (month) {
    const budget = budgets[month];
    const totals = summary.monthly.get(month) || { income: 0, expenses: 0 };
    const limit = Number(budget.total);
    const item = document.createElement("article");
    item.className = "budget-report-item";

    const heading = document.createElement("div");
    heading.className = "budget-report-heading";
    const name = document.createElement("h3");
    name.textContent = monthLabel(month);
    const amount = document.createElement("span");
    amount.textContent = formatMoney(totals.expenses) + " spent of " + formatMoney(limit);
    heading.append(name, amount);

    const progress = createProgress(totals.expenses, limit, monthLabel(month) + " budget usage", "budget-progress");
    const note = document.createElement("p");
    note.className = "budget-usage-note";
    note.textContent = totals.expenses > limit
      ? "Over budget by " + formatMoney(totals.expenses - limit)
      : formatMoney(limit - totals.expenses) + " remaining";
    if (totals.expenses >= limit) {
      note.classList.add("budget-warning");
    }
    item.append(heading, progress, note);

    const limits = budget.categories && typeof budget.categories === "object" ? budget.categories : {};
    const limitedCategories = Object.keys(limits).filter(function (category) {
      return Number.isFinite(Number(limits[category])) && Number(limits[category]) > 0;
    });
    if (limitedCategories.length) {
      const categories = document.createElement("p");
      categories.className = "budget-category-limits";
      categories.textContent = "Category limits: " + limitedCategories.map(function (category) {
        return category + " " + formatMoney(Number(limits[category]));
      }).join(" · ");
      item.append(categories);
    }
    budgetReportList.append(item);
  });
}

function renderSavingsGoals() {
  savingsReportList.replaceChildren();
  const validGoals = savingsGoals.filter(function (goal) {
    return goal && typeof goal === "object";
  });
  if (validGoals.length === 0) {
    const message = document.createElement("p");
    message.className = "empty-message";
    message.textContent = "No savings goals are available yet.";
    savingsReportList.append(message);
    return;
  }

  validGoals.forEach(function (goal) {
    const target = Number(goal.targetAmount);
    const saved = goalSavedAmount(goal);
    const safeTarget = Number.isFinite(target) && target > 0 ? target : 0;
    const safeSaved = Number.isFinite(saved) && saved > 0 ? saved : 0;
    const percentage = safeTarget > 0 ? Math.round((safeSaved / safeTarget) * 100) : 0;
    const item = document.createElement("article");
    item.className = "report-savings-item";

    const heading = document.createElement("div");
    heading.className = "budget-report-heading";
    const name = document.createElement("h3");
    name.textContent = goal.name || "Untitled goal";
    const amount = document.createElement("span");
    amount.textContent = formatMoney(safeSaved) + " of " + formatMoney(safeTarget);
    heading.append(name, amount);

    const progress = document.createElement("progress");
    progress.className = "savings-progress";
    progress.max = 100;
    progress.value = Math.min(percentage, 100);
    progress.setAttribute("aria-label", (goal.name || "Savings goal") + ": " + percentage + "% complete");
    const note = document.createElement("p");
    note.className = "savings-progress-note";
    note.textContent = percentage + "% complete";
    item.append(heading, progress, note);
    savingsReportList.append(item);
  });
}

function render() {
  const period = periodInput.value;
  const months = periodMonths(period);
  const selectedTransactions = filterTransactions(period);
  const summary = summarizeTransactions(selectedTransactions);
  const hasAnySavedTransactions = transactions.some(function (item) { return item && monthKey(item.date); });

  setSummary(summary, period);
  emptyMessage.hidden = hasAnySavedTransactions;
  emptyMessage.textContent = hasAnySavedTransactions
    ? ""
    : "No transaction data is available yet. Add income or expenses to see your financial reports.";
  if (hasAnySavedTransactions && selectedTransactions.length === 0) {
    emptyMessage.hidden = false;
    emptyMessage.textContent = "No transactions are available for this period. Try another report period.";
  }

  drawCharts(summary, months);
  renderCategoryTable(summary.categories);
  renderMonthlyTable(summary, months);
  renderBudgets(months, summary);
  renderSavingsGoals();
}

function showReadError() {
  reportsMessage.textContent = "Some saved data could not be read. Check your browser storage data.";
  reportsMessage.classList.add("error");
}

function loadData() {
  try {
    transactions = readArray(TRANSACTIONS_KEY, "transaction");
    budgets = readObject(BUDGETS_KEY, "budget");
    savingsGoals = readArray(SAVINGS_KEY, "savings goals");
    reportsMessage.textContent = "";
    reportsMessage.classList.remove("error");
    render();
  } catch (error) {
    showReadError();
  }
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

periodInput.addEventListener("change", render);
window.addEventListener("storage", function (event) {
  if (event.key === TRANSACTIONS_KEY || event.key === BUDGETS_KEY ||
      event.key === SAVINGS_KEY || event.key === null) {
    loadData();
  }
});

loadData();
setupMenu();
