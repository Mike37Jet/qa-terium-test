export const TIMEOUT = {
  // Navegación y carga
  NAVIGATION: 15000,
  LOADING_MODAL: 15000,

  // Respuestas de red (POST)
  RESPONSE: 12000,
  RESPONSE_CONVERT: 15000,

  // Elementos y contenido
  ELEMENT: 5000,
  CONTENT: 10000,

  // Combos vue-select
  LISTBOX: 5000,
  COMBO_STABLE: 12000,
  COMBO_CHIP: 4000,
  COMBO_COMMIT: 2000,

  // Modales
  MODAL_SHOW: 7000,
  MODAL_HIDE: 10000,
  MODAL_PROBE: 2500,
  BACKDROP_DETACH: 5000,
  PENDING_ORDERS: 8000,

  // Toasts
  TOAST: 6000,
  TOAST_HIDE: 5000,

  // Clics con reintento
  CLICK_TRIAL: 1200,
  CLICK_RETRY: 1500,
  BTN_VISIBLE: 3000,

  // Micro-esperas
  QUICK: 2000,
  EXAM_RESULT: 600,
  LIST_REFRESH: 1500,

  // Test largo
  TEST_LONG: 200000,

  // Config (playwright.config.js)
  TEST: 150000,
  EXPECT: 10000,
  ACTION: 15000,
  NAVIGATION_DEFAULT: 15000,
};
