// getDay(): 0 = domingo, 6 = sábado. Una cita en fin de semana deshabilita #crearPedido.
const WEEKEND_DAYS = new Set([0, 6]);

// 'aaaa-mm-dd': el formato que aceptan los datepickers de la app al escribir.
export const formatDateAsYYYYMMDD = (date) => {
  const padTwoDigits = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${padTwoDigits(date.getMonth() + 1)}-${padTwoDigits(date.getDate())}`;
};

// Suma días a una fecha sin mutar la original (setDate sobre el objeto recibido sí lo haría).
export const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

// Devuelve la misma fecha si es día hábil, o el siguiente lunes. No muta la original.
export const nextWeekday = (date) => {
  const result = new Date(date);
  while (WEEKEND_DAYS.has(result.getDay())) {
    result.setDate(result.getDate() + 1);
  }
  return result;
};

export const parseMoneyToNumber = (raw = '') => {
  const cleaned = String(raw).replace(/[^\d,.\-]/g, '');
  const normalized = cleaned.includes(',') && cleaned.includes('.')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned.replace(',', '.');
  return Number(normalized);
};
