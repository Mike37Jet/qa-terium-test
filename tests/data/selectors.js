// Combos vue-select por su LABEL visible: los ids #vsN derivan al cambiar la app y hay homónimos en modales ocultos.
export const COMBO = {
  ORDER: {
    client: 'Cliente',
    careType: 'Tipo atención',
    service: 'Servicio',
    healthPlan: 'Plan salud',
  },
  INDENT: {
    client: 'Cliente',
    careType: 'Tipo atención',
    service: 'Servicio',
    healthPlan: 'Plan salud',
  },
};

// avisoImportante no tiene id estable: se ubica por el texto de su encabezado.
export const MODAL = {
  highlightedNotifications: 'notificaciones-destacadas-modal',
  pendingOrders: 'ordenes-desde-pedidos-cotizaciones-modal',
  patientSearch: 'buscar-paciente-modal',
  loading: 'cargando-modal',
  avisoImportante: 'aviso importante',
};

// Llevan '#' porque solo se usan como locator; los de MODAL van sin '#' (se pasan a Bootstrap).
export const PATIENT = {
  identificationInput: '#identificacion',
  nameCard: '#paciente-nombre',
  firstResultRow: '#paciente-0', // el modal de búsqueda numera las filas desde 0
};

export const EXAM = {
  searchInput: '#buscar-examen-input',
  // El :not excluye #examen-id, el contenedor vue-select, que si no falsea el conteo del bucle.
  resultRow: '[id^="examen-"]:not([id$="-id"])',
};

// Los ids de campo van SIN '#': varios se pasan crudos a helpers que reciben un id.

// Ubicación y signos: los MISMOS campos aparecen en el form de pedido y en el de orden.
export const LOCATION_FIELD = {
  floor: 'piso',
  room: 'sala',
  bed: 'cama',
  temperature: 'temperatura',
};

// Cama y temperatura no exponen id, name ni label[for]: el único ancla es el texto del label.
export const LOCATION_LABEL = {
  bed: 'Cama',
  temperature: 'Temperatura',
};

export const INDENT_FIELD = {
  observations: 'observaciones-registro',
  diagnosisConcept: 'diagnostico-concepto',
  save: 'crearPedido',
};

export const ORDER_FIELD = {
  save: 'crear-orden',
  update: 'actualizar-orden',
  listTable: 'listado',
  doctorName: 'medico-nombre',
  phlebotomistName: 'flebotomista-nombre',
  patientTypeCombo: 'tipo-paciente-id',
  group: 'grupo',
  indentNumber: 'numero-pedido',
  portalObservations: 'observaciones-portal',
  receiptObservations: 'observaciones-recibo',
  labObservations: 'observaciones-laboratorista',
  resultsObservations: 'observaciones-resultados',
  discountPercent: 'porcentaje-descuento',
  surchargePercent: 'porcentaje-recargo',
  deliveryValue: 'valor-domicilio',
  sampleCollectionValue: 'valor-toma-muestra',
};

export const BILLING_FIELD = {
  idType: 'tipo-identificacion-datos-facturas-receptor',
  idNumber: 'numero-identificacion-datos-facturas-receptor',
  name: 'razon-social-datos-facturas-receptor',
  phone: 'telefono-datos-facturas-receptor',
  address: 'direccion-datos-facturas-receptor',
  email: 'correo-datos-facturas-receptor',
};

// Las claves coinciden con DEFAULT_ORDER.deliveryMethods: el bucle las recorre por nombre.
export const DELIVERY_CHECKBOX = {
  correo: 'entregar-por-correo',
  whatsapp: 'entregar-por-whatsapp',
  impreso: 'entregar-por-impreso',
};

// El tooltip del botón-lupa vive en `title` o `data-bs-title` según el componente.
export const LOOKUP = {
  searchButtonInGroup: [
    'button[title*="Buscar" i]',
    'button[data-bs-title*="Buscar" i]',
    'button[data-bs-original-title*="Buscar" i]',
    'button:has(i.fa-search)',
  ].join(', '),
  openDoctor: 'Búsqueda',
  openDiagnosis: 'Buscar Diagnóstico',
  phlebotomistModal: 'Flebotomistas',
  // Botón que confirma la fila. El de médico tiene title propio y cae al genérico si no está.
  selectRow: 'button[title="Seleccionar"]',
  selectDoctorRow: 'button[title="Seleccionar médico"], button[title="Seleccionar"]',
};

// Hay varias tablas en la página: la del listado se identifica por su cabecera de número.
export const INDENT_LIST = {
  idColumnHeader: 'No.',
};

// Ni el botón que lo abre ni el modal tienen id: se ubican por su texto.
export const TIME_MODAL = {
  title: 'Definir hora',
  confirmButton: 'Seleccionar',
};

// El badge del conteo no tiene id ni clase propia: su tooltip es lo único estable.
export const ORDER_DETAIL = {
  examCountBadge: 'span.badge[data-bs-title="Cantidad"]',
};

// El menú solo se pinta al hover y el tooltip de cada botón cambia de atributo según el componente.
export const ROW_ACTION = {
  menu: '.menu-oculto',
  edit: ':is(button[title*="Editar" i], button[data-bs-title*="Editar" i], button:has(i.fa-edit))',
  detail: ':is(button[data-bs-original-title*="Reportar y validar" i], button[title*="Reportar y validar" i], button:has(i.fa-tasks))',
};

// Térium usa `.alert`, no el `.toast` de Bootstrap.
export const TOAST = '.position-fixed.end-0 .alert, .position-fixed.end-0 .toast, .toast.show, [role="alert"]';

// El contador de cupos no tiene id: se ancla en el texto de su label.
export const AGENDA = {
  availableSlotsLabel: 'Disponibles',
};

export const DATE_FIELD = {
  appointment: 'fecha-cita',
  attendance: 'fecha-asistencia',
  estimatedDelivery: 'fecha-entrega-estimada',
  processing: 'fecha-procesamiento',
};
