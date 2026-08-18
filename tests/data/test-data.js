export const DEFAULT_INDENT = {
  floor: '1',
  room: '2',
  bed: '3',
  temp: '35',
  observation: 'Observacion pedido',
  // Días hábiles que se recorren buscando cupo: los 10 primeros suelen estar llenos.
  appointmentLookaheadDays: 30,
};

export const DEFAULT_ORDER = {
  sampleDelivery: 'Persona entrega muestra',
  deliveryMethods: {
    correo: true,
    whatsapp: true,
    impreso: true,
  },
  // idType 'OTRO' evita la validación de checksum de Cédula/RUC con datos sintéticos.
  billing: {
    idType: 'OTRO',
    idNumber: '1717171717',
    name: 'Receptor Factura QA',
    phone: '0991234567',
    address: 'Av. Principal 123',
    email: 'factura.qa@example.com',
  },
  observations: {
    recibo: 'Observacion recibo',
    laboratorista: 'Observacion laboratorista',
    resultados: 'Observacion resultados',
    portal: 'Observacion portal',
  },
  signs: {
    temperatura: '35',
    grupo: '1',
    piso: '2',
    sala: '3',
    cama: '4',
    numeroPedido: '5',
  },
  totals: {
    descuento: '10',
    recargo: '10',
    domicilio: '1',
    tomaMuestra: '1',
  },
  // Solo hora/minuto (24h); la fecha se resuelve a HOY en runtime. El backend exige la hora para persistir.
  processingDates: {
    asistencia: { hora: '8', minuto: '30' },
    entrega: { hora: '17', minuto: '0' },
    procesamiento: { hora: '10', minuto: '15' },
  },
};

export const TEST_USERS = {
  knownEmail: 'soporte@orion-labs.com',
  unknownEmail: 'noexiste@ejemplo.com',
};

export const LOGIN = {
  welcomeUrl: /\/bienvenida(?:$|[/?])/,
  cases: [
    { name: 'valid', email: process.env.AUTH_USER, pass: process.env.AUTH_PASS, expectSuccess: true },
    { name: 'invalid-password', email: TEST_USERS.knownEmail, pass: 'wrongpassword1', expectSuccess: false },
    { name: 'invalid-user-and-password', email: TEST_USERS.unknownEmail, pass: 'wrongpassword2', expectSuccess: false },
    { name: 'invalid-user-correct-password', email: TEST_USERS.unknownEmail, pass: process.env.AUTH_PASS, expectSuccess: false },
  ],
};
