// The dashboard reads transactions saved by the Add Transaction page.

const STORAGE_KEY = "fms.transactions";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
let overviewChart = null;

function readTransactions() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) {
      return { transactions: [], error: "" };
    }

    const data = JSON.parse(saved);
    if (!Array.isArray(data) || data.some(function (item) {
      return !item || typeof item !== "object" || Array.isArray(item);
    })) {
      return {
        transactions: [],
        error: "Saved transaction data is invalid. Please check your browser storage."
      };
    }
    return { transactions: data, error: "" };
  } catch (error) {
    return {
      transactions: [],
      error: "Saved transaction data could not be read. Please check your browser storage."
    };
  }
}

function showChartMessage(id, text) {
  const chartWrap = document.querySelector(".chart-wrap");
  let message = document.getElementById(id);
  if (!message) {
    message = document.createElement("p");
    message.id = id;
    message.className = "card-note";
    message.setAttribute("role", "status");
    message.setAttribute("aria-live", "polite");
    chartWrap.insertBefore(message, chartWrap.firstChild);
  }
  message.textContent = text;
  message.hidden = !text;
}

function formatMoney(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
}

function summarize(transactions) {
  let income = 0;
  let expenses = 0;

  transactions.forEach(function (item) {
    const amount = Number(item.amount) || 0;
    if (item.type === "income") {
      income += amount;
    }
    if (item.type === "expense") {
      expenses += amount;
    }
  });

  return {
    income: income,
    expenses: expenses,
    balance: income - expenses,
    count: transactions.length
  };
}

function showSummary(summary) {
  document.getElementById("balance").textContent = formatMoney(summary.balance);
  document.getElementById("income").textContent = formatMoney(summary.income);
  document.getElementById("expenses").textContent = formatMoney(summary.expenses);
  document.getElementById("transaction-count").textContent = String(summary.count);
}

function monthlyTotals(transactions) {
  const income = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const expenses = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const year = new Date().getFullYear();

  transactions.forEach(function (item) {
    const date = new Date(item.date);
    if (Number.isNaN(date.getTime()) || date.getFullYear() !== year) {
      return;
    }

    const amount = Number(item.amount) || 0;
    const month = date.getMonth();
    if (item.type === "income") {
      income[month] += amount;
    }
    if (item.type === "expense") {
      expenses[month] += amount;
    }
  });

  return { income: income, expenses: expenses };
}

function drawChart(transactions) {
  const canvas = document.getElementById("overview-chart");
  if (typeof Chart === "undefined") {
    canvas.hidden = true;
    showChartMessage(
      "chart-unavailable-message",
      "Chart unavailable. Please check your internet connection and refresh."
    );
    return;
  }

  showChartMessage("chart-unavailable-message", "");
  canvas.hidden = false;
  if (overviewChart) {
    overviewChart.destroy();
  }
  const existingChart = typeof Chart.getChart === "function" ? Chart.getChart(canvas) : null;
  if (existingChart) {
    existingChart.destroy();
  }

  const totals = monthlyTotals(transactions);

  overviewChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: MONTHS,
      datasets: [
        {
          label: "Income",
          data: totals.income,
          backgroundColor: "#d4c6ef",
          borderRadius: 8
        },
        {
          label: "Expenses",
          data: totals.expenses,
          backgroundColor: "#7b68b0",
          borderRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom"
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          suggestedMax: 1000
        }
      }
    }
  });
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

  function openMenu() {
    sidebar.classList.add("open");
    button.setAttribute("aria-expanded", "true");
    backdrop.hidden = false;
  }

  button.addEventListener("click", function () {
    if (sidebar.classList.contains("open")) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  backdrop.addEventListener("click", closeMenu);
}

setupMenu();
const savedTransactions = readTransactions();
showSummary(summarize(savedTransactions.transactions));
showChartMessage("transaction-data-message", savedTransactions.error);
if (savedTransactions.error) {
  document.getElementById("overview-chart").hidden = true;
} else {
  drawChart(savedTransactions.transactions);
}
