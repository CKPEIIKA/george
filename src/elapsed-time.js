// A single unit and fixed decimal precision keep the live counter steady.
export function elapsedSeconds(milliseconds, language = 'en', digits = 1) {
  return new Intl.NumberFormat(language, {
    minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: false,
  }).format(Math.max(0, milliseconds) / 1000);
}
