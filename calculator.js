const DAY_MS = 1000 * 60 * 60 * 24;
const THREE_YEAR_LIMIT_DAYS = 1095;
const RESET_ABSENCE_DAYS = 60;

function parseDate(value) {
  if (!value) return null;

  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateString(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTodayUtc() {
  const now = new Date();

  return new Date(
    Date.UTC(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    )
  );
}

function differenceInDays(start, end) {
  return Math.floor((end - start) / DAY_MS);
}

function inclusiveDays(start, end) {
  return differenceInDays(start, end) + 1;
}

export function analyzeStays(rawStays) {
  const today = getTodayUtc();

  const parsed = rawStays.map((stay, index) => {
    const arrival = parseDate(stay.arrival);
    const departure = parseDate(stay.departure);

    return {
      ...stay,
      originalIndex: index,
      arrival,
      departure,
      errors: []
    };
  });

  for (const stay of parsed) {
    if (!stay.arrival && !stay.departure) {
      continue;
    }

    if (!stay.arrival) {
      stay.errors.push("Arrival date is required.");
      continue;
    }

    if (stay.arrival > today) {
      stay.errors.push("Arrival date cannot be in the future.");
    }

    if (stay.departure) {
      if (stay.departure < stay.arrival) {
        stay.errors.push("Departure cannot be before arrival.");
      }

      if (stay.departure > today) {
        stay.errors.push("Departure date cannot be in the future.");
      }
    }
  }

  const populatedStays = parsed.filter((stay) => stay.arrival);

  const sorted = [...populatedStays].sort((a, b) => {
    return a.arrival - b.arrival;
  });

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];

    if (!next) continue;

    const currentEnd = current.departure ?? today;

    if (!current.departure) {
      current.errors.push(
        "A stay without a departure date must be the most recent stay."
      );
    }

    if (next.arrival <= currentEnd) {
      current.errors.push("This stay overlaps another stay.");
      next.errors.push("This stay overlaps another stay.");
    }
  }

  const duplicateKeys = new Map();

  for (const stay of sorted) {
    const key = `${stay.arrival ? formatDateString(stay.arrival) : ""}|${stay.departure ? formatDateString(stay.departure) : ""}`;

    if (!duplicateKeys.has(key)) {
      duplicateKeys.set(key, []);
    }

    duplicateKeys.get(key).push(stay);
  }

  for (const matches of duplicateKeys.values()) {
    if (matches.length > 1) {
      for (const stay of matches) {
        stay.errors.push("This stay appears to be duplicated.");
      }
    }
  }

  const hasErrors = parsed.some((stay) => stay.errors.length > 0);

  if (hasErrors) {
    return {
      rows: buildRowResults(parsed, today),
      sorted,
      hasErrors: true,
      totalDays: 0,
      daysRemaining: THREE_YEAR_LIMIT_DAYS,
      lastReset: null
    };
  }

  let currentPeriodDays = 0;
  let lastReset = null;

  const gapResults = [];

  for (let i = 0; i < sorted.length; i++) {
    const stay = sorted[i];
    const end = stay.departure ?? today;
    const stayDays = inclusiveDays(stay.arrival, end);

    if (i > 0) {
      const previous = sorted[i - 1];
      const previousEnd = previous.departure ?? today;

      const absenceDays = differenceInDays(previousEnd, stay.arrival) - 1;
      const resets = absenceDays >= RESET_ABSENCE_DAYS;

      gapResults.push({
        beforeOriginalIndex: stay.originalIndex,
        previousOriginalIndex: previous.originalIndex,
        absenceDays,
        resets
      });

      if (resets) {
        currentPeriodDays = 0;

        lastReset = {
          absenceDays,
          priorDeparture: formatDateString(previousEnd),
          nextArrival: formatDateString(stay.arrival)
        };
      }
    }

    currentPeriodDays += stayDays;
  }

  return {
    rows: buildRowResults(parsed, today, gapResults),
    sorted,
    hasErrors: false,
    totalDays: currentPeriodDays,
    daysRemaining: Math.max(THREE_YEAR_LIMIT_DAYS - currentPeriodDays, 0),
    exceededBy: Math.max(currentPeriodDays - THREE_YEAR_LIMIT_DAYS, 0),
    lastReset
  };
}

function buildRowResults(parsed, today, gapResults = []) {
  return parsed.map((stay) => {
    let days = null;

    if (
      stay.arrival &&
      !stay.errors.some((error) =>
        error.includes("Departure cannot be before arrival")
      )
    ) {
      const end = stay.departure ?? today;

      if (end >= stay.arrival) {
        days = inclusiveDays(stay.arrival, end);
      }
    }

    const gap = gapResults.find(
      (item) => item.previousOriginalIndex === stay.originalIndex
    );

    return {
      originalIndex: stay.originalIndex,
      arrival: stay.arrival ? formatDateString(stay.arrival) : "",
      departure: stay.departure ? formatDateString(stay.departure) : "",
      days,
      errors: [...new Set(stay.errors)],
      gap
    };
  });
}
