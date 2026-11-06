const STORAGE_KEY = "fms.transactions";

const form = document.getElementById("transaction-form");
const message = document.getElementById("form-message");
const amountInput = document.getElementById("amount");
const categoryInput = document.getElementById("category");
const descriptionInput = document.getElementById("description");

function showMessage(text, isError) {
  message.textContent = text;
  message.classList.toggle("error", isError);
}

function readTransactions() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === null) {
    return [];
  }

  const transactions = JSON.parse(saved);
  if (!Array.isArray(transactions)) {
    throw new Error("Saved transaction data is not a list.");
  }
  return transactions;
}

function createTransactionId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
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

form.addEventListener("input", function () {
  showMessage("", false);
  amountInput.setCustomValidity("");
  categoryInput.setCustomValidity("");
  descriptionInput.setCustomValidity("");
});

form.addEventListener("submit", function (event) {
  event.preventDefault();

  const amount = Number(amountInput.value);
  amountInput.setCustomValidity(amount > 0 ? "" : "Enter an amount greater than zero.");
  categoryInput.setCustomValidity(categoryInput.value.trim() ? "" : "Enter a category.");
  descriptionInput.setCustomValidity(descriptionInput.value.trim() ? "" : "Enter a description.");

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const transaction = {
    id: createTransactionId(),
    type: document.getElementById("type").value,
    amount: amount,
    category: categoryInput.value.trim(),
    date: document.getElementById("date").value,
    description: descriptionInput.value.trim()
  };

  try {
    const transactions = readTransactions();
    transactions.push(transaction);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  } catch (error) {
    showMessage("Unable to save the transaction. Check browser storage and try again.", true);
    return;
  }

  form.reset();
  showMessage("Transaction saved successfully.", false);
});

setupMenu();
