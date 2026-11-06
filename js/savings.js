const STORAGE_KEY = "fms.savingsGoals";
const goalForm = document.getElementById("goal-form");
const goalList = document.getElementById("savings-goal-list");
const goalMessage = document.getElementById("savings-message");
const formMessage = document.getElementById("goal-form-message");
const formHeading = document.getElementById("goal-form-heading");
const saveGoalButton = document.getElementById("save-goal-button");
const cancelEditButton = document.getElementById("cancel-goal-edit");
let goals = [];
let editingId = null;

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}

function formatMoney(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(amount);
}

function formatDate(dateValue) {
  if (!isValidDate(dateValue)) {
    return String(dateValue || "Date not set");
  }
  const parts = dateValue.split("-");
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return date.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

function isValidDate(dateValue) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue || ""));
  if (!match) {
    return false;
  }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1]) &&
    date.getMonth() === Number(match[2]) - 1 &&
    date.getDate() === Number(match[3]);
}

function todayDate() {
  const now = new Date();
  return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" +
    String(now.getDate()).padStart(2, "0");
}

function contributionTotal(contributions) {
  return contributions.reduce(function (total, contribution) {
    return total + contribution.amount;
  }, 0);
}

function normalizeGoals(savedGoals) {
  const usedIds = new Set();
  return savedGoals.map(function (goal) {
    if (!goal || typeof goal !== "object" || Array.isArray(goal)) {
      return goal;
    }

    const contributions = [];
    (Array.isArray(goal.contributions) ? goal.contributions : []).forEach(function (contribution) {
      if (!contribution || typeof contribution !== "object") {
        return;
      }
      const amount = Number(contribution.amount);
      if (!Number.isFinite(amount) || amount <= 0 || !isValidDate(contribution.date)) {
        return;
      }

      let id = String(contribution.id || "");
      if (!id || usedIds.has(id)) {
        id = createId();
        while (usedIds.has(id)) {
          id = createId();
        }
      }
      usedIds.add(id);
      contributions.push({ id: id, amount: amount, date: contribution.date });
    });

    const savedAmount = Number(goal.currentAmount);
    const historyTotal = contributionTotal(contributions);
    const existingOpening = Number(goal.openingAmount);
    const openingAmount = goal.openingAmount !== undefined && Number.isFinite(existingOpening) && existingOpening >= 0
      ? existingOpening
      : Math.max(0, (Number.isFinite(savedAmount) && savedAmount >= 0 ? savedAmount : historyTotal) - historyTotal);

    return Object.assign({}, goal, {
      openingAmount: openingAmount,
      contributions: contributions,
      currentAmount: openingAmount + historyTotal
    });
  });
}

function createContributionId() {
  const existingIds = new Set();
  goals.forEach(function (goal) {
    (Array.isArray(goal.contributions) ? goal.contributions : []).forEach(function (contribution) {
      existingIds.add(contribution.id);
    });
  });

  let id = createId();
  while (existingIds.has(id)) {
    id = createId();
  }
  return id;
}

function showGoalMessage(text, isError) {
  goalMessage.textContent = text;
  goalMessage.classList.toggle("error", isError);
}

function showFormMessage(text, isError) {
  formMessage.textContent = text;
  formMessage.classList.toggle("error", isError);
}

function readGoals() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === null) {
    return [];
  }
  const data = JSON.parse(saved);
  if (!Array.isArray(data)) {
    throw new Error("Saved savings goals data is not a list.");
  }
  return data;
}

function saveGoals() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
    showGoalMessage("", false);
    renderGoals();
    return true;
  } catch (error) {
    showGoalMessage("Unable to save changes. Check browser storage and try again.", true);
    return false;
  }
}

function makeGoalCard(goal) {
  const card = document.createElement("article");
  card.className = "savings-goal-card";

  const header = document.createElement("div");
  header.className = "savings-goal-header";
  const title = document.createElement("h3");
  title.textContent = goal.name || "Untitled goal";
  const date = document.createElement("span");
  date.className = "savings-target-date";
  date.textContent = "Target: " + formatDate(goal.targetDate);
  header.append(title, date);

  const target = Number(goal.targetAmount);
  const saved = Number(goal.currentAmount);
  const safeTarget = Number.isFinite(target) && target > 0 ? target : 0;
  const safeSaved = Number.isFinite(saved) && saved >= 0 ? saved : 0;
  const percentage = safeTarget > 0 ? Math.round((safeSaved / safeTarget) * 100) : 0;
  const values = document.createElement("div");
  values.className = "savings-goal-values";
  const savedValue = document.createElement("strong");
  savedValue.textContent = formatMoney(safeSaved) + " saved";
  const targetValue = document.createElement("span");
  targetValue.textContent = "of " + formatMoney(safeTarget);
  values.append(savedValue, targetValue);

  const progress = document.createElement("progress");
  progress.className = "savings-progress";
  progress.max = 100;
  progress.value = Math.min(percentage, 100);
  progress.setAttribute("aria-label", goal.name + ": " + percentage + "% complete");

  const progressNote = document.createElement("p");
  progressNote.className = "savings-progress-note";
  progressNote.textContent = percentage + "% complete";
  if (safeSaved >= safeTarget && safeTarget > 0) {
    progressNote.classList.add("savings-complete");
    progressNote.textContent = "Goal reached! " + percentage + "% saved.";
  }

  card.append(header, values, progress, progressNote);
  const openingAmount = Number(goal.openingAmount) || 0;
  if (openingAmount > 0) {
    const openingNote = document.createElement("p");
    openingNote.className = "savings-progress-note";
    openingNote.textContent = formatMoney(openingAmount) + " starting balance (no contribution date)";
    card.append(openingNote);
  }
  if (goal.description) {
    const description = document.createElement("p");
    description.className = "savings-description";
    description.textContent = goal.description;
    card.append(description);
  }

  const contributionForm = document.createElement("form");
  contributionForm.className = "savings-contribution-form";
  const contributionField = document.createElement("div");
  contributionField.className = "form-field";
  const contributionLabel = document.createElement("label");
  const contributionId = "contribution-" + goal.id;
  contributionLabel.htmlFor = contributionId;
  contributionLabel.textContent = "Add contribution (₹)";
  const contributionInput = document.createElement("input");
  contributionInput.id = contributionId;
  contributionInput.type = "number";
  contributionInput.min = "0.01";
  contributionInput.step = "any";
  contributionInput.placeholder = "Amount";
  contributionInput.required = true;
  const dateField = document.createElement("div");
  dateField.className = "form-field";
  const dateId = "contribution-date-" + goal.id;
  const dateLabel = document.createElement("label");
  dateLabel.htmlFor = dateId;
  dateLabel.textContent = "Contribution date";
  const dateInput = document.createElement("input");
  dateInput.id = dateId;
  dateInput.type = "date";
  dateInput.value = todayDate();
  dateInput.required = true;
  dateField.append(dateLabel, dateInput);
  contributionField.append(contributionLabel, contributionInput);

  const contributionButton = document.createElement("button");
  contributionButton.type = "submit";
  contributionButton.className = "primary-button";
  contributionButton.textContent = "Add Money";
  contributionForm.append(contributionField, dateField, contributionButton);
  contributionForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const amount = Number(contributionInput.value);
    if (!Number.isFinite(amount) || amount <= 0 || !isValidDate(dateInput.value) ||
        !contributionForm.checkValidity()) {
      contributionForm.reportValidity();
      return;
    }

    const goalIndex = goals.findIndex(function (item) {
      return item.id === goal.id;
    });
    if (goalIndex < 0) {
      return;
    }

    const previousGoal = goals[goalIndex];
    const contributions = Array.isArray(previousGoal.contributions) ? previousGoal.contributions : [];
    const contribution = {
      id: createContributionId(),
      amount: amount,
      date: dateInput.value
    };
    const openingAmount = Number(previousGoal.openingAmount) || 0;
    goals[goalIndex] = Object.assign({}, previousGoal, {
      openingAmount: openingAmount,
      contributions: contributions.concat(contribution),
      currentAmount: openingAmount + contributionTotal(contributions) + amount
    });
    if (saveGoals()) {
      showGoalMessage("Contribution added to \"" + previousGoal.name + "\".", false);
    } else {
      goals[goalIndex] = previousGoal;
    }
  });
  const history = document.createElement("details");
  history.className = "savings-contribution-history";
  const historySummary = document.createElement("summary");
  historySummary.textContent = "Contribution history (" + (goal.contributions || []).length + ")";
  history.append(historySummary);
  const historyList = document.createElement("ul");
  historyList.className = "savings-contribution-list";
  (Array.isArray(goal.contributions) ? goal.contributions : []).slice().reverse().forEach(function (item) {
    const entry = document.createElement("li");
    entry.textContent = formatDate(item.date) + " - " + formatMoney(Number(item.amount));
    historyList.append(entry);
  });
  if (historyList.childElementCount === 0) {
    const entry = document.createElement("li");
    entry.textContent = "No dated contributions yet.";
    historyList.append(entry);
  }
  history.append(historyList);

  const actions = document.createElement("div");
  actions.className = "savings-goal-actions";
  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "secondary-button";
  editButton.textContent = "Edit";
  editButton.addEventListener("click", function () {
    editGoal(goal.id);
  });

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "delete-button";
  deleteButton.textContent = "Delete";
  deleteButton.addEventListener("click", function () {
    deleteGoal(goal.id);
  });
  actions.append(editButton, deleteButton);
  card.append(contributionForm, history, actions);
  return card;
}

function renderGoals() {
  goalList.replaceChildren();
  const validGoals = goals.filter(function (goal) {
    return goal && typeof goal === "object";
  });
  if (validGoals.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "empty-message";
    emptyMessage.textContent = "No savings goals yet. Create your first goal below to start tracking your progress.";
    goalList.append(emptyMessage);
    return;
  }

  validGoals.forEach(function (goal) {
    goalList.append(makeGoalCard(goal));
  });
}

function resetGoalForm() {
  goalForm.reset();
  goalForm.elements.saved.value = "0";
  editingId = null;
  formHeading.textContent = "Create a savings goal";
  saveGoalButton.textContent = "Create Goal";
  cancelEditButton.hidden = true;
  showFormMessage("", false);
}

function editGoal(id) {
  const goal = goals.find(function (item) {
    return item.id === id;
  });
  if (!goal) {
    return;
  }

  editingId = id;
  goalForm.elements.name.value = goal.name || "";
  goalForm.elements.target.value = goal.targetAmount;
  goalForm.elements.saved.value = getGoalSavedAmount(goal);
  goalForm.elements.targetDate.value = goal.targetDate || "";
  goalForm.elements.description.value = goal.description || "";
  formHeading.textContent = "Edit savings goal";
  saveGoalButton.textContent = "Save Changes";
  cancelEditButton.hidden = false;
  showFormMessage("", false);
  goalForm.scrollIntoView({ behavior: "smooth", block: "start" });
  goalForm.elements.name.focus();
}

function getGoalSavedAmount(goal) {
  const openingAmount = Number(goal.openingAmount);
  const historyTotal = contributionTotal(Array.isArray(goal.contributions) ? goal.contributions : []);
  if (Number.isFinite(openingAmount) && openingAmount >= 0) {
    return openingAmount + historyTotal;
  }
  const currentAmount = Number(goal.currentAmount);
  return Number.isFinite(currentAmount) && currentAmount >= 0 ? currentAmount : historyTotal;
}

function deleteGoal(id) {
  const index = goals.findIndex(function (goal) {
    return goal.id === id;
  });
  if (index < 0) {
    return;
  }

  const goal = goals[index];
  if (!window.confirm("Delete \"" + (goal.name || "this savings goal") + "\"? This action cannot be undone.")) {
    return;
  }

  goals.splice(index, 1);
  if (editingId === id) {
    resetGoalForm();
  }
  if (!saveGoals()) {
    goals.splice(index, 0, goal);
    renderGoals();
  }
}

goalForm.addEventListener("input", function () {
  showFormMessage("", false);
});

goalForm.addEventListener("submit", function (event) {
  event.preventDefault();
  const name = goalForm.elements.name.value.trim();
  const targetAmount = Number(goalForm.elements.target.value);
  const currentAmount = Number(goalForm.elements.saved.value);
  const targetDate = goalForm.elements.targetDate.value;

  if (!name || !Number.isFinite(targetAmount) || targetAmount <= 0 ||
      !Number.isFinite(currentAmount) || currentAmount < 0 || !targetDate ||
      !goalForm.checkValidity()) {
    goalForm.reportValidity();
    return;
  }

  const goalData = {
    name: name,
    targetAmount: targetAmount,
    targetDate: targetDate,
    description: goalForm.elements.description.value.trim()
  };
  let successMessage;
  let previousGoals;

  if (editingId) {
    const index = goals.findIndex(function (goal) {
      return goal.id === editingId;
    });
    if (index < 0) {
      resetGoalForm();
      showFormMessage("This savings goal is no longer available to edit.", true);
      return;
    }
    previousGoals = goals.slice();
    const contributions = Array.isArray(goals[index].contributions) ? goals[index].contributions : [];
    const historyTotal = contributionTotal(contributions);
    if (currentAmount < historyTotal) {
      showFormMessage("Current saved amount cannot be less than the dated contributions.", true);
      return;
    }
    goals[index] = Object.assign({}, goals[index], goalData, {
      openingAmount: currentAmount - historyTotal,
      contributions: contributions,
      currentAmount: currentAmount
    });
    successMessage = "Savings goal updated successfully.";
  } else {
    previousGoals = goals.slice();
    goals.push(Object.assign({ id: createId(), openingAmount: currentAmount, contributions: [] }, goalData, {
      currentAmount: currentAmount
    }));
    successMessage = "Savings goal created successfully.";
  }

  if (saveGoals()) {
    resetGoalForm();
    showGoalMessage(successMessage, false);
  } else {
    goals = previousGoals;
    renderGoals();
  }
});

cancelEditButton.addEventListener("click", resetGoalForm);

window.addEventListener("storage", function (event) {
  if (event.key !== STORAGE_KEY && event.key !== null) {
    return;
  }
  try {
    goals = normalizeGoals(readGoals());
    if (editingId && !goals.some(function (goal) { return goal && goal.id === editingId; })) {
      resetGoalForm();
    }
    showGoalMessage("", false);
    renderGoals();
  } catch (error) {
    showGoalMessage("Saved savings goals could not be read. Check the browser storage data.", true);
  }
});

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

try {
  goals = normalizeGoals(readGoals());
  renderGoals();
} catch (error) {
  showGoalMessage("Saved savings goals could not be read. Check the browser storage data.", true);
}

setupMenu();
