export interface SM2Result {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewDate: string; // ISO 8601 string
}

/**
 * SuperMemo-2 (SM-2) Spaced Repetition Algorithm
 * 
 * @param quality Recall rating from 0 (complete blackout) to 5 (perfect response)
 * @param easeFactor Current easiness factor (minimum 1.3, initial typically 2.5)
 * @param intervalDays Previous interval in days
 * @param repetitions Number of consecutive successful recalls (quality >= 3)
 * @param fromDate Reference date to calculate next review date (defaults to now)
 */
export function calculateSM2(
  quality: number,
  easeFactor = 2.5,
  intervalDays = 0,
  repetitions = 0,
  fromDate: Date = new Date()
): SM2Result {
  // Clamp quality between 0 and 5
  const q = Math.max(0, Math.min(5, Math.round(quality)));

  // Calculate new Ease Factor:
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  let newEaseFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (newEaseFactor < 1.3) {
    newEaseFactor = 1.3;
  }
  // Round to 3 decimal places
  newEaseFactor = Math.round(newEaseFactor * 1000) / 1000;

  let newRepetitions = repetitions;
  let newIntervalDays = intervalDays;

  if (q < 3) {
    // Failure / lapse: reset repetitions and schedule for next day
    newRepetitions = 0;
    newIntervalDays = 1;
  } else {
    // Success: increment repetition and calculate next interval
    if (newRepetitions === 0) {
      newIntervalDays = 1;
    } else if (newRepetitions === 1) {
      newIntervalDays = 6;
    } else {
      newIntervalDays = Math.round(intervalDays * newEaseFactor);
    }
    newRepetitions += 1;
  }

  // Calculate next review timestamp (preserving time or setting at day boundary)
  const nextDate = new Date(fromDate.getTime());
  nextDate.setDate(nextDate.getDate() + newIntervalDays);

  return {
    easeFactor: newEaseFactor,
    intervalDays: newIntervalDays,
    repetitions: newRepetitions,
    nextReviewDate: nextDate.toISOString(),
  };
}
