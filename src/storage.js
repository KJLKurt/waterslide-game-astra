const root = new URL(import.meta.env.BASE_URL, location.href).pathname;
export const STORAGE_KEY = `splashline:${root}:v1`;
export const defaults = {
  graphics: 'auto', sensitivity: 1, handedness: 'right', shadows: false,
  postprocessing: false, effects: true, sound: true, music: false, practice: false,
};
export const PALETTES = [
  { name: 'Lagoon', color: '#27b9bb', ring: '#dbf884', skin: '#bd784f' },
  { name: 'Guava', color: '#f47d88', ring: '#ffcb7c', skin: '#eebc92' },
  { name: 'Lilac', color: '#a79cef', ring: '#f9f2d4', skin: '#81503f' },
  { name: 'Sunshine', color: '#f5bd53', ring: '#91e5d7', skin: '#e3a57c' },
];
export function loadProfile() {
  let raw = {};
  try { raw = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { /* A corrupt save should never block playing. */ }
  const settings = { ...defaults };
  for (const key of Object.keys(defaults)) {
    if (typeof raw.settings?.[key] === typeof defaults[key]) settings[key] = raw.settings[key];
  }
  if (!['auto', 'high', 'low'].includes(settings.graphics)) settings.graphics = 'auto';
  if (!['left', 'right'].includes(settings.handedness)) settings.handedness = 'right';
  settings.sensitivity = Math.min(1.7, Math.max(0.5, settings.sensitivity));
  return {
    settings,
    best: Object.fromEntries(['race', 'practice'].filter(k => Number.isFinite(raw.best?.[k]) && raw.best[k] > 0).map(k => [k, raw.best[k]])),
    palette: Number.isInteger(raw.palette) && raw.palette >= 0 && raw.palette < 4 ? raw.palette : 0,
    accessory: ['goggles', 'cap', 'classic', 'crown'].includes(raw.accessory) ? raw.accessory : 'goggles',
    unlocks: Array.isArray(raw.unlocks) ? raw.unlocks.filter(v => ['first-splash', 'shortcut', 'champion'].includes(v)) : [],
  };
}
export function saveProfile(profile) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); return true; } catch { return false; }
}
export function formatTime(time) {
  if (time == null) return '—';
  return `${Math.floor(time / 60).toString().padStart(2, '0')}:${(time % 60).toFixed(2).padStart(5, '0')}`;
}
