const STORAGE_KEY = "fms.transactions";
const transactionList = document.getElementById("transaction-list");
const searchInput = document.getElementById("transaction-search");
const filterInput = document.getElementById("transaction-filter");
const historyMessage = document.getElementById("history-message");
const editSection = document.getElementById("edit-section");
const editForm = document.getElementById("edit-form");
const editMessage = document.getElementById("edit-message");
let transactions = [];
let editingIndex = -1;

function formatMoney(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(amount);
}

function formatDate(dateValue) {
  const parts = String(dateValue || "").split("-");
  if (parts.length !== 3) {
    return String(dateValue || "Date not available");
  }

  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (Number.isNaN(date.getTime())) {
    return String(dateValue);
  }
  return date.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

function showHistoryMessage(text, isError) {
  historyMessage.textContent = text;
  historyMessage.classList.toggle("error", isError);
}

function readTransactions() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === null) {
    return [];
  }

  const data = JSON.parse(saved);
  if (!Array.isArray(data)) {
    throw new Error("Saved transaction data is not a list.");
  }
  return data;
}

function saveTransactions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    showHistoryMessage("", false);
    renderTransactions();
    return true;
  } catch (error) {
    showHistoryMessage("Unable to save changes. Check browser storage and try again.", true);
    return false;
  }
}

function createDetail(label, value) {
  const detail = document.createElement("div");
  detail.className = "transaction-detail";

  const heading = document.createElement("span");
  heading.className = "transaction-detail-label";
  heading.textContent = label;

  const content = document.createElement("span");
  content.className = "transaction-detail-value";
  content.textContent = value;

  detail.append(heading, content);
  return detail;
}

function createTransactionCard(transaction, index) {
  const card = document.createElement("article");
  card.className = "transaction-item";

  const header = document.createElement("div");
  header.className = "transaction-item-header";

  const title = document.createElement("h2");
  title.className = "transaction-title";
  title.textContent = transaction.description || "Untitled transaction";

  const type = document.createElement("span");
  const isIncome = transaction.type === "income";
  type.className = "transaction-type " + (isIncome ? "income" : "expense");
  type.textContent = isIncome ? "Income" : "Expense";
  header.append(title, type);

  const details = document.createElement("div");
  details.className = "transaction-details";
  const amount = Number(transaction.amount);
  details.append(
    createDetail("Category", transaction.category || "Uncategorized"),
    createDetail("Amount", Number.isFinite(amount) ? formatMoney(amount) : "Amount not available"),
    createDetail("Date", formatDate(transaction.date))
  );

  const actions = document.createElement("div");
  actions.className = "transaction-actions";

  const editButton = document.createElement("button");
  editButton.className = "secondary-button";
  editButton.type = "button";
  editButton.textContent = "Edit";
  editButton.addEventListener("click", function () {
    openEditor(index);
  });

  const deleteButton = document.createElement("button");
  deleteButton.className = "delete-button";
  deleteButton.type = "button";
  deleteButton.textContent = "Delete";
  deleteButton.addEventListener("click", function () {
    deleteTransaction(index);
  });

  actions.append(editButton, deleteButton);
  card.append(header, details, actions);
  return card;
}

function renderTransactions() {
  const searchTerm = searchInput.value.trim().toLocaleLowerCase();
  const selectedType = filterInput.value;
  const filtered = transactions
    .map(function (transaction, index) {
      return { transaction: transaction, index: index };
    })
    .filter(function (entry) {
      const transaction = entry.transaction;
      if (!transaction || typeof transaction !== "object") {
        return false;
      }
      const matchesSearch = String(transaction.description || "").toLocaleLowerCase().includes(searchTerm) ||
        String(transaction.category || "").toLocaleLowerCase().includes(searchTerm);
      const matchesType = selectedType === "all" || transaction.type === selectedType;
      return matchesSearch && matchesType;
    });

  transactionList.replaceChildren();
  if (transactions.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "empty-message";
    emptyMessage.textContent = "No transactions yet. Add a transaction to see it here.";
    transactionList.append(emptyMessage);
    return;
  }

  if (filtered.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "empty-message";
    emptyMessage.textContent = "No transactions match your search or filter.";
    transactionList.append(emptyMessage);
    return;
  }

  filtered.forEach(function (entry) {
    transactionList.append(createTransactionCard(entry.transaction, entry.index));
  });
}

function openEditor(index) {
  const transaction = transactions[index];
  if (!transaction) {
    return;
  }

  editingIndex = index;
  editForm.elements.type.value = transaction.type === "expense" ? "expense" : "income";
  editForm.elements.amount.value = transaction.amount;
  editForm.elements.category.value = transaction.category || "";
  editForm.elements.date.value = transaction.date || "";
  editForm.elements.description.value = transaction.description || "";
  editMessage.textContent = "";
  editMessage.classList.remove("error");
  editSection.hidden = false;
  editSection.scrollIntoView({ behavior: "smooth", block: "start" });
  editForm.elements.description.focus();
}

function closeEditor() {
  editSection.hidden = true;
  editForm.reset();
  editMessage.textContent = "";
  editingIndex = -1;
}

function deleteTransaction(index) {
  const transaction = transactions[index];
  if (!transaction) {
    return;
  }

  const name = transaction.description || "this transaction";
  if (!window.confirm("Delete \"" + name + "\"? This action cannot be undone.")) {
    return;
  }

  transactions.splice(index, 1);
  if (editingIndex === index) {
    closeEditor();
  } else if (editingIndex > index) {
    editingIndex -= 1;
  }
  if (!saveTransactions()) {
    transactions.splice(index, 0, transaction);
    if (editingIndex >= index) {
      editingIndex += 1;
    }
  }
}

searchInput.addEventListener("input", renderTransactions);
filterInput.addEventListener("change", renderTransactions);

editForm.addEventListener("submit", function (event) {
  event.preventDefault();
  const amount = Number(editForm.elements.amount.value);
  const category = editForm.elements.category.value.trim();
  const description = editForm.elements.description.value.trim();

  if (!Number.isFinite(amount) || amount <= 0 || !category || !description || !editForm.checkValidity()) {
    editForm.reportValidity();
    return;
  }

  if (editingIndex < 0 || !transactions[editingIndex]) {
    closeEditor();
    showHistoryMessage("This transaction is no longer available to edit.", true);
    return;
  }

  const current = transactions[editingIndex];
  transactions[editingIndex] = {
    ...current,
    type: editForm.elements.type.value,
    amount: amount,
    category: category,
    date: editForm.elements.date.value,
    description: description
  };

  if (saveTransactions()) {
    closeEditor();
  } else {
    transactions[editingIndex] = current;
  }
});

document.getElementById("cancel-edit").addEventListener("click", closeEditor);

window.addEventListener("storage", function (event) {
  if (event.key !== STORAGE_KEY && event.key !== null) {
    return;
  }

  try {
    transactions = readTransactions();
    showHistoryMessage("", false);
    renderTransactions();
    if (editingIndex >= transactions.length) {
      closeEditor();
    }
  } catch (error) {
    showHistoryMessage("Saved transactions could not be read. Check the browser storage data.", true);
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
  transactions = readTransactions();
  renderTransactions();
} catch (error) {
  showHistoryMessage("Saved transactions could not be read. Check the browser storage data.", true);
}

setupMenu();
