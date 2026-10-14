// Preferences never affect the algebra or replace the current presentation.
const KEY = 'george.preferences.v1';
export function readPreferences(storage, browserLanguage = 'en') {
  let saved = {};
  try { saved = JSON.parse(storage?.getItem(KEY) || '{}') || {}; } catch { /* storage unavailable */ }
  return {
    language: ['en', 'ru'].includes(saved.language) ? saved.language : browserLanguage.toLowerCase().startsWith('ru') ? 'ru' : 'en',
    theme: ['auto', 'light', 'dark'].includes(saved.theme) ? saved.theme : 'auto',
  };
}
export function savePreferences(storage, preferences) {
  try { storage?.setItem(KEY, JSON.stringify(preferences)); } catch { /* storage unavailable */ }
}
export function applyTheme(theme, root = document.documentElement) {
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  else delete root.dataset.theme;
}
