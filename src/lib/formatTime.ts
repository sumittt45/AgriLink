const IST = "Asia/Kolkata";

/**
 * Full date + time in IST.
 * Output: "28 Mar 2026, 02:09 PM"
 */
export const formatOrderTime = (date: string | Date): string =>
  new Date(date).toLocaleString("en-IN", {
    timeZone: IST,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

/**
 * Date only in IST (with year).
 * Output: "28 Mar 2026"
 */
export const formatOrderDate = (date: string | Date): string =>
  new Date(date).toLocaleDateString("en-IN", {
    timeZone: IST,
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/**
 * Short date without year (for pickup notices etc).
 * Output: "28 Mar"
 */
export const formatShortDate = (date: string | Date): string =>
  new Date(date).toLocaleDateString("en-IN", {
    timeZone: IST,
    day: "numeric",
    month: "short",
  });
