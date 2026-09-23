import { analyzeStays } from "./calculator.js";

const staysList = document.querySelector("#stays-list");
const addStayButton = document.querySelector("#add-stay-button");
const stayRowTemplate = document.querySelector("#stay-row-template");

const validationSummary = document.querySelector("#validation-summary");

const daysAccrued = document.querySelector("#days-accrued");
const daysRemaining = document.querySelector("#days-remaining");

const resetSummary = document.querySelector("#reset-summary");
const resetSummaryText = document.querySelector("#reset-summary-text");

function createStayRow({ arrival = "", departure = "" } = {}) {
  const fragment = stayRowTemplate.content.cloneNode(true);

  const stayBlock = fragment.querySelector(".stay-block");
  const arrivalInput = fragment.querySelector(".arrival-input");
  const departureInput = fragment.querySelector(".departure-input");
  const removeButton = fragment.querySelector(".remove-button");

  arrivalInput.value = arrival;
  departureInput.value = departure;

  arrivalInput.addEventListener("input", updateCalculator);
  departureInput.addEventListener("input", updateCalculator);

  removeButton.addEventListener("click", () => {
    stayBlock.remove();

    if (!staysList.querySelector(".stay-block")) {
      createStayRow();
    }

    updateCalculator();
  });

  staysList.appendChild(fragment);
}

function collectStays() {
  return [...staysList.querySelectorAll(".stay-block")].map((block) => ({
    arrival: block.querySelector(".arrival-input").value,
    departure: block.querySelector(".departure-input").value
  }));
}

function clearRowDisplays() {
  const blocks = staysList.querySelectorAll(".stay-block");

  blocks.forEach((block) => {
    const daysValue = block.querySelector(".days-value");
    const rowError = block.querySelector(".row-error");
    const gapInfo = block.querySelector(".gap-info");

    daysValue.textContent = "—";

    rowError.textContent = "";
    rowError.hidden = true;

    gapInfo.hidden = true;
  });
}

function renderRows(result) {
  clearRowDisplays();

  const blocks = [...staysList.querySelectorAll(".stay-block")];

  result.rows.forEach((row) => {
    const block = blocks[row.originalIndex];

    if (!block) return;

    const daysValue = block.querySelector(".days-value");
    const rowError = block.querySelector(".row-error");
    const gapInfo = block.querySelector(".gap-info");
    const gapDays = block.querySelector(".gap-days");
    const gapReset = block.querySelector(".gap-reset");

    if (row.days !== null) {
      daysValue.textContent = row.days.toLocaleString();
    }

    if (row.errors.length) {
      rowError.textContent = row.errors.join(" ");
      rowError.hidden = false;
    }

    if (row.gap) {
      gapInfo.hidden = false;

      gapDays.textContent = `${row.gap.absenceDays.toLocaleString()} day${row.gap.absenceDays === 1 ? "" : "s"} outside U.S.`;

      gapReset.hidden = !row.gap.resets;
    }
  });
}

function renderSummary(result) {
  if (result.hasErrors) {
    daysAccrued.textContent = "—";
    daysRemaining.textContent = "—";

    validationSummary.textContent =
      "Please correct the highlighted date issues before relying on the total.";

    validationSummary.hidden = false;

    resetSummary.hidden = true;
    return;
  }

  validationSummary.hidden = true;

  daysAccrued.textContent = result.totalDays.toLocaleString();
  daysRemaining.textContent = result.daysRemaining.toLocaleString();

  if (result.lastReset) {
    resetSummary.hidden = false;

    resetSummaryText.textContent =
      `${result.lastReset.absenceDays} uninterrupted days outside the United States reset the current three-year period.`;
  } else {
    resetSummary.hidden = true;
  }

  if (result.exceededBy > 0) {
    validationSummary.textContent =
      `The entered stays exceed the 1,095-day limit by ${result.exceededBy.toLocaleString()} day${result.exceededBy === 1 ? "" : "s"}.`;

    validationSummary.hidden = false;
  }
}

function updateCalculator() {
  const stays = collectStays();
  const result = analyzeStays(stays);

  renderRows(result);
  renderSummary(result);
}

addStayButton.addEventListener("click", () => {
  createStayRow();
  updateCalculator();
});

createStayRow();
updateCalculator();
