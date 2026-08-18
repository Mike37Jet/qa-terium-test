import { expect } from '@playwright/test';
import { HelpersPage } from './helpers.page';
import { formatDateAsYYYYMMDD, parseMoneyToNumber } from '../utils/format.utils';
import { DEFAULT_ORDER } from '../data/test-data';
import {
  BILLING_FIELD, COMBO, DATE_FIELD, DELIVERY_CHECKBOX, INDENT_FIELD, LOCATION_FIELD,
  LOOKUP, MODAL, ORDER_DETAIL, ORDER_FIELD, PATIENT, ROW_ACTION, TIME_MODAL,
} from '../data/selectors';
import { ROUTE, createPath, listPagePath, listSearchPath, urlPattern } from '../data/routes';
import { TIMEOUT } from '../data/timeouts';

// Etiqueta visible: la app rotula "Tipo de objeto" un campo que en realidad es el tipo de paciente.
const PATIENT_TYPE_COMBO_LABEL = 'Tipo de objeto';

export class OrderPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.helpers = new HelpersPage(page);
  }

  // Solo los delegados con llamador real; el resto se usa por this.helpers.*.
  openComboAndSelectFirstOption = (selector) => this.helpers.openComboAndSelectFirstOption(selector);
  selectFirstComboOptionWithExams = (selector) => this.helpers.selectFirstComboOptionWithExams(selector);
  selectFirstPatient = () => this.helpers.selectFirstPatient();
  addExamsByQuery = (query = 'EX') => this.helpers.addExamsByQuery(query);
  dismissAllNotificationsIfPresent = () => this.helpers.dismissAllNotificationsIfPresent();

  async goto() {
    await this.page.goto(createPath(ROUTE.orders), { waitUntil: 'domcontentloaded' });
    await this.page.waitForURL(urlPattern.page(createPath(ROUTE.orders)), { timeout: TIMEOUT.NAVIGATION });
    await this.page
      .locator(`#${ORDER_FIELD.save}, a[role="tab"][href="#datos-generales-tab"], ${PATIENT.identificationInput}`)
      .first()
      .waitFor({ state: 'visible', timeout: TIMEOUT.NAVIGATION });
    await this.helpers.dismissAllNotificationsIfPresent();
    await this.helpers.registerNotificationHandlers();
  }

  // Cierra el modal de pedidos/cotizaciones pendientes que puede auto-abrirse tras seleccionar paciente (espera corta).
  async dismissPendingOrdersModal(timeout = TIMEOUT.PENDING_ORDERS) {
    const modal = this.page.locator(`#${MODAL.pendingOrders}.show`);
    await modal.waitFor({ state: 'visible', timeout: TIMEOUT.MODAL_PROBE }).catch(() => null);
    await this.helpers.dismissPendingOrdersModal(timeout);
  }

  // Lanza el modal de búsqueda de personal asociado al input dado y selecciona la primera fila.
  async searchPersonnel(inputId, { title, fieldToAssert } = {}) {
    const group = this.page.locator(`.input-group:has(#${inputId})`).first();
    const searchButton = group.locator(LOOKUP.searchButtonInGroup).first();

    await expect(searchButton).toBeVisible({ timeout: TIMEOUT.ELEMENT });
    await this.helpers.waitForLoadingModal();
    await searchButton.click();

    await this.helpers.selectFirstRowFromTableModal({
      title,
      postAssert: fieldToAssert
        ? async () => { await expect(this.page.locator(`#${fieldToAssert}`)).toHaveValue(/.+/); }
        : undefined,
    });
  }

  async selectDoctor() {
    await this.searchPersonnel(ORDER_FIELD.doctorName, { fieldToAssert: ORDER_FIELD.doctorName });
  }

  async selectPhlebotomist() {
    await this.searchPersonnel(ORDER_FIELD.phlebotomistName, {
      title: LOOKUP.phlebotomistModal,
      fieldToAssert: ORDER_FIELD.phlebotomistName,
    });
  }

  async selectDiagnosis() {
    await this.searchPersonnel(INDENT_FIELD.diagnosisConcept);
  }

  async fillObservations() {
    const { observations } = DEFAULT_ORDER;
    await this.page.getByLabel('Observaciones recibo').fill(observations.recibo);
    await this.page.getByLabel('Observaciones laboratorista').fill(observations.laboratorista);
    await this.page.getByLabel('Observaciones resultados').fill(observations.resultados);
  }

  async fillTotals() {
    const { totals } = DEFAULT_ORDER;
    await this.helpers.clearAndFillInput(`#${ORDER_FIELD.discountPercent}`, totals.descuento);
    await this.helpers.clearAndFillInput(`#${ORDER_FIELD.surchargePercent}`, totals.recargo);
    await this.helpers.clearAndFillInput(`#${ORDER_FIELD.deliveryValue}`, totals.domicilio);
    await this.helpers.clearAndFillInput(`#${ORDER_FIELD.sampleCollectionValue}`, totals.tomaMuestra);
  }

  // Solo los combos que el snapshot vuelve a leer tras guardar.
  async fillAdditionalData() {
    await this.helpers.switchToTab('Datos adicionales');
    await this.helpers.openComboAndSelectFirstOption(COMBO.ORDER.healthPlan);
    await this.selectPatientType();
    await this.selectDiagnosis();
  }

  async selectDeliveryMethods() {
    const { deliveryMethods } = DEFAULT_ORDER;
    for (const [key, fieldId] of Object.entries(DELIVERY_CHECKBOX)) {
      if (!deliveryMethods[key]) continue;
      const checkbox = this.page.locator(`#${fieldId}`);
      await expect(checkbox, `Delivery checkbox "${key}" not visible`).toBeVisible({ timeout: TIMEOUT.ELEMENT });
      await checkbox.check();
      await expect(checkbox).toBeChecked();
    }
  }

  async fillBillingData() {
    const { billing } = DEFAULT_ORDER;
    await this.helpers.switchToTab('Datos de facturación');

    await this.page.locator(`#${BILLING_FIELD.idType}`).selectOption(billing.idType);
    await this.helpers.clearAndFillInput(`#${BILLING_FIELD.idNumber}`, billing.idNumber);
    await this.helpers.clearAndFillInput(`#${BILLING_FIELD.name}`, billing.name);
    await this.helpers.clearAndFillInput(`#${BILLING_FIELD.phone}`, billing.phone);
    await this.helpers.clearAndFillInput(`#${BILLING_FIELD.address}`, billing.address);
    await this.helpers.clearAndFillInput(`#${BILLING_FIELD.email}`, billing.email);
  }

  async getBillingSnapshot() {
    await this.helpers.switchToTab('Datos de facturación');
    const [idType, idNumber, name, phone, address, email] = await Promise.all([
      this.helpers.getFieldValue(this.page.locator(`#${BILLING_FIELD.idType}`)),
      this.helpers.getFieldValue(this.page.locator(`#${BILLING_FIELD.idNumber}`)),
      this.helpers.getFieldValue(this.page.locator(`#${BILLING_FIELD.name}`)),
      this.helpers.getFieldValue(this.page.locator(`#${BILLING_FIELD.phone}`)),
      this.helpers.getFieldValue(this.page.locator(`#${BILLING_FIELD.address}`)),
      this.helpers.getFieldValue(this.page.locator(`#${BILLING_FIELD.email}`)),
    ]);
    return { idType, idNumber, name, phone, address, email };
  }

  // El backend exige la hora para persistir, así que tras la fecha se abre el modal "Definir hora".
  async fillDateTime(inputId, { hora, minuto }, dateStr = formatDateAsYYYYMMDD(new Date())) {
    const input = this.page.locator(`#${inputId}`);
    await expect(input, `Date input #${inputId} not visible`).toBeVisible({ timeout: TIMEOUT.ELEMENT });
    await input.fill(dateStr);
    // Commit con blur (no Enter, que dispararía el submit del form).
    await input.blur();
    await expect(input).toHaveValue(dateStr);

    // Los campos solo-fecha no tienen ese botón: sin ancestro que lo contenga, se deja la fecha.
    const timeButtonSelector = `button[data-bs-title="${TIME_MODAL.title}"], button[title="${TIME_MODAL.title}"]`;
    const timeButton = input
      .locator(`xpath=ancestor::*[.//button[@title="${TIME_MODAL.title}" or @data-bs-title="${TIME_MODAL.title}"]][1]`)
      .locator(timeButtonSelector)
      .first();
    if ((await timeButton.count()) === 0) return;

    await timeButton.click();
    // El id del modal no siempre deriva del input: lo ubicamos por su título "Definir hora".
    const modal = this.page.locator('.modal.show').filter({ hasText: TIME_MODAL.title }).first();
    await modal.waitFor({ state: 'visible', timeout: TIMEOUT.ELEMENT });
    const hourInput = modal.locator('input[type="number"]').nth(0);
    const minuteInput = modal.locator('input[type="number"]').nth(1);
    await hourInput.fill(String(hora));
    await hourInput.blur();
    await minuteInput.fill(String(minuto));
    await minuteInput.blur();
    await modal.getByRole('button', { name: TIME_MODAL.confirmButton, exact: true }).click();
    await modal.waitFor({ state: 'hidden', timeout: TIMEOUT.BACKDROP_DETACH }).catch(() => null);
  }

  // Selecciona la primera opción del combo de tipo de paciente (rotulado "Tipo de objeto").
  async selectPatientType() {
    const container = this.page.locator(`#${ORDER_FIELD.patientTypeCombo}`);
    await expect(container, `Combo "${PATIENT_TYPE_COMBO_LABEL}" (#${ORDER_FIELD.patientTypeCombo}) not visible`)
      .toBeVisible({ timeout: TIMEOUT.ELEMENT });
    const combo = container.locator('[role="combobox"]').first();
    await this.helpers.openComboLocatorAndSelectFirst(combo, PATIENT_TYPE_COMBO_LABEL, {}, container);
  }

  // Llena las fechas de proceso (asistencia, entrega, procesamiento) con fecha de hoy + hora.
  async fillProcessingDates() {
    const { processingDates } = DEFAULT_ORDER;
    await this.helpers.switchToTab('Datos adicionales');
    await this.fillDateTime(DATE_FIELD.attendance, processingDates.asistencia);
    await this.fillDateTime(DATE_FIELD.estimatedDelivery, processingDates.entrega);
    await this.fillDateTime(DATE_FIELD.processing, processingDates.procesamiento);
  }

  // Rellena signos vitales y ubicación del paciente (temperatura, grupo, piso, sala, cama, etc.).
  async fillSigns() {
    const { signs, observations } = DEFAULT_ORDER;
    await this.page.getByLabel('Temperatura').fill(signs.temperatura);
    await this.page.getByLabel('Grupo').fill(signs.grupo);
    await this.page.getByLabel('Piso').fill(signs.piso);
    await this.page.getByLabel('Sala').fill(signs.sala);
    await this.page.getByLabel('Cama').fill(signs.cama);
    await this.page.getByLabel('Número pedido').fill(signs.numeroPedido);
    await this.page.getByLabel('Observaciones portal').fill(observations.portal);
  }

  // Guarda la orden esperando un POST /ordenes exitoso y devuelve el ID de la orden creada.
  async saveAndGetOrderId() {
    const saveButton = this.page.locator(`#${ORDER_FIELD.save}`);
    const isOrderPost = response => response.url().includes(ROUTE.orders) && response.request().method() === 'POST';

    const { response, lastToast, attempts } = await this.helpers.clickSaveUntilPostSent(saveButton, {
      isPost: isOrderPost,
      formUrlPattern: urlPattern.page(createPath(ROUTE.orders)),
    });

    if (!response) {
      // Salimos del form sin respuesta → el submit funcionó: tomamos el id del listado.
      if (!urlPattern.page(createPath(ROUTE.orders)).test(this.page.url())) {
        return await this.getTopListOrderId();
      }
      const errors = await this.page
        .locator('form .invalid-feedback, form .is-invalid, form [aria-invalid="true"], form .form-control.is-invalid + .invalid-feedback')
        .filter({ hasText: /\S/ })
        .allInnerTexts()
        .catch(() => []);
      const cleaned = errors
        .map(text => text.replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      const message = cleaned.slice(0, 5).join(' | ') || 'sin mensajes de validación visibles en el form';

      // Cambiar a "Datos generales" para que la screenshot-on-failure capture esa pestaña y leer Servicio por LABEL.
      await this.page.getByRole('tab', { name: 'Datos generales' }).click().catch(() => { });
      const service = await this.helpers.getSelectedComboText(COMBO.ORDER.service).catch(() => '?');
      const careType = await this.helpers.getSelectedComboText(COMBO.ORDER.careType).catch(() => '?');
      const doctor = await this.helpers.getFieldValue(this.page.locator(`#${ORDER_FIELD.doctorName}`)).catch(() => '?');
      const state = `[generales] servicio="${service}" tipoAtencion="${careType}" medico="${doctor}"`;
      const toast = lastToast ? ` [toast] ${lastToast}` : '';
      throw new Error(`POST ${ROUTE.orders} was never sent after ${attempts} attempts (validation blocked submit): ${message} ${state}${toast}`);
    }

    this.helpers.expectSuccessfulSave(response, ROUTE.orders);

    // numero_orden desde la respuesta del POST (no la "primera fila"), con fallback al listado.
    try {
      const body = await response.json();
      const orderNumber = body?.data?.numero_orden ?? body?.numero_orden ?? body?.data?.numero;
      if (orderNumber) return String(orderNumber).replace(/\D/g, '');
    } catch { /* respuesta no-JSON: caemos al listado */ }

    return await this.getTopListOrderId();
  }

  // Lee el "Valor total" en pantalla durante la creación y lo devuelve como texto y número.
  async getTotalOnCreateForm() {
    await this.helpers.switchToTab('Datos generales');

    const totalValue = this.page
      .locator('label:has-text("Valor total")')
      .locator('xpath=following::div[contains(@class,"fw-bold")][1]');
    await expect(totalValue).toBeVisible({ timeout: TIMEOUT.CONTENT });

    const raw = (await totalValue.innerText()).trim();
    const value = parseMoneyToNumber(raw);
    expect(Number.isFinite(value), `Could not parse Valor total: "${raw}"`).toBe(true);

    return { raw, value };
  }

  // Navega al listado de órdenes (tolera el abort si la app redirige /ordenes?page=1 → /ordenes).
  async gotoOrdersList(pageNum = 1) {
    await this.page.goto(listPagePath(ROUTE.orders, pageNum), { waitUntil: 'domcontentloaded' }).catch(() => null);
    await this.page.waitForURL(urlPattern.list(ROUTE.orders), { timeout: TIMEOUT.NAVIGATION }).catch(() => null);
    await this.page.locator(`#${ORDER_FIELD.listTable} > tbody`).waitFor({ state: 'visible', timeout: TIMEOUT.NAVIGATION });
    await this.helpers.waitForLoadingModal();
  }

  // Filtra el listado por ID en vez de recorrer páginas: no depende del volumen ni de otras sesiones.
  async findOrderRow(orderId) {
    const idStr = String(orderId);
    await this.page.goto(listSearchPath(ROUTE.orders, idStr), { waitUntil: 'domcontentloaded' }).catch(() => null);
    await this.page.locator(`#${ORDER_FIELD.listTable} > tbody`).waitFor({ state: 'visible', timeout: TIMEOUT.NAVIGATION });
    await this.helpers.waitForLoadingModal();

    // El filtro es por texto y puede traer parciales (1234 ↔ 12345): se exige el número exacto.
    const rows = this.page.locator(`#${ORDER_FIELD.listTable} > tbody > tr`);
    for (let i = 0, rowCount = await rows.count(); i < rowCount; i++) {
      const boxes = rows.nth(i).locator('td').first().locator('div.cursor-pointer');
      const boxCount = await boxes.count();
      for (let j = 0; j < boxCount; j++) {
        const digits = (await boxes.nth(j).innerText().catch(() => '')).replace(/\D/g, '');
        if (digits === idStr) return rows.nth(i);
      }
    }
    return null;
  }

  // Lee el total visible en la última celda de una fila del listado de órdenes.
  async getListTotalFromRow(row) {
    const totalCell = row.locator('td').last().locator('div').last();
    await expect(totalCell).toBeVisible({ timeout: TIMEOUT.CONTENT });
    const raw = (await totalCell.innerText()).trim();
    return { raw, value: parseMoneyToNumber(raw) };
  }

  // Devuelve el ID de la primera fila del listado, navegando primero al índice si no estamos en él.
  async getTopListOrderId() {
    if (!urlPattern.list(ROUTE.orders).test(this.page.url())) {
      await this.gotoOrdersList(1);
    }
    await this.page.locator(`#${ORDER_FIELD.listTable} > tbody`).waitFor({ state: 'visible', timeout: TIMEOUT.NAVIGATION });
    const orderNumberBox = this.page
      .locator(`#${ORDER_FIELD.listTable} > tbody > tr`)
      .first()
      .locator('td')
      .first()
      .locator('div.cursor-pointer');

    await orderNumberBox.waitFor({ state: 'visible', timeout: TIMEOUT.NAVIGATION });

    const raw = (await orderNumberBox.innerText()).trim();
    const digits = raw.replace(/\D/g, '');
    expect(digits, `Could not read ID from first row: "${raw}"`).toMatch(/^\d+$/);

    return digits;
  }

  // Camino ÚNICO para las acciones de fila: el menú solo se pinta al hover y hay que forzarlo por JS.
  async _clickRowAction(orderId, actionSelector) {
    const idStr = String(orderId);
    const row = await this.findOrderRow(idStr);
    expect(row, `Order ${idStr} not found in the list (filtered by cadenaBusqueda)`).toBeTruthy();

    await row.scrollIntoViewIfNeeded();
    await this.helpers.dismissAllNotificationsIfPresent();
    await row.hover();

    const actions = row.locator(ROW_ACTION.menu).first();
    const handle = await actions.elementHandle();
    if (handle) {
      await this.page.evaluate(element => {
        element.classList.remove('d-none');
        Object.assign(element.style, {
          display: 'block', visibility: 'visible', opacity: '1', pointerEvents: 'auto', zIndex: 9999,
        });
      }, handle);
    }
    await this.page.evaluate(() => {
      document.querySelectorAll('.tooltip.show, .popover.show, .modal-backdrop')
        .forEach(element => element.remove());
    });

    await this.helpers.clickWithFallback(actions.locator(actionSelector).first());
  }

  // Abre el detalle "Resultados y validación" de la orden y espera que cargue el card de exámenes.
  async openOrderDetailById(orderId) {
    await this._clickRowAction(orderId, ROW_ACTION.detail);
    await this.page.locator(ORDER_DETAIL.examCountBadge).first().waitFor({ state: 'visible', timeout: TIMEOUT.NAVIGATION });
  }

  // Lee el badge "Cantidad" del card de Exámenes en la vista de detalle y devuelve el número.
  async getDetailExamCount() {
    const badge = this.page.locator(ORDER_DETAIL.examCountBadge).first();
    await expect(badge).toBeVisible({ timeout: TIMEOUT.CONTENT });
    const raw = (await badge.innerText()).trim();
    const count = parseInt(raw, 10);
    expect(Number.isFinite(count), `Badge "Cantidad" is not numeric: "${raw}"`).toBe(true);
    return count;
  }

  // Cuenta las filas de examen (tr.examen) en la vista de detalle.
  async getDetailExamRowCount() {
    return await this.page.locator('tr.examen').count();
  }

  // Abre la orden indicada para edición y espera a que el formulario de edición esté montado.
  async openOrderForEditById(orderId) {
    await this._clickRowAction(orderId, ROW_ACTION.edit);
    await this.page.waitForURL(urlPattern.edit(ROUTE.orders), { timeout: TIMEOUT.NAVIGATION });
    await this.page.locator(`#${ORDER_FIELD.update}`).waitFor({ state: 'visible', timeout: TIMEOUT.NAVIGATION });
    await this.helpers.waitForLoadingModal();
  }

  // Cambia al tab "Datos adicionales" dentro del formulario de orden.
  async openAdditionalDataTab() {
    await this.helpers.switchToTab('Datos adicionales');
  }

  // Captura los datos de la pestaña Datos generales como objeto serializable para comparar.
  async getGeneralDataSnapshot() {
    // El header se hidrata por XHR con opacity-0: se espera por texto, no por visibilidad.
    const card = this.page.locator(`${PATIENT.nameCard} .col-auto`).first();
    await expect(card, 'El nombre del paciente no se hidrató al reabrir la orden')
      .toHaveText(/\S/, { timeout: TIMEOUT.NAVIGATION });
    const patientName = ((await card.textContent()) || '').replace(/\s+/g, ' ').trim();

    const [
      client,
      careType,
      service,
      orderDate,
      externalReference,
      receiptObservations,
      labObservations,
      resultObservations,
      doctorName,
    ] = await Promise.all([
      this.helpers.getSelectedComboText(COMBO.ORDER.client),
      this.helpers.getSelectedComboText(COMBO.ORDER.careType),
      this.helpers.getSelectedComboText(COMBO.ORDER.service),
      this.helpers.getFieldValue(this.page.getByRole('textbox', { name: /Fecha pedido/i })),
      this.helpers.getFieldValue(this.page.getByLabel('Referencia sistema externo')),
      this.helpers.getFieldValue(this.page.locator(`#${ORDER_FIELD.receiptObservations}`)),
      this.helpers.getFieldValue(this.page.locator(`#${ORDER_FIELD.labObservations}`)),
      this.helpers.getFieldValue(this.page.locator(`#${ORDER_FIELD.resultsObservations}`)),
      this.helpers.getFieldValue(this.page.locator(`#${ORDER_FIELD.doctorName}`)),
    ]);

    return {
      patientName,
      client,
      careType,
      service,
      orderDate,
      externalReference,
      receiptObservations,
      labObservations,
      resultObservations,
      doctorName,
    };
  }

  // Captura los datos de la pestaña Datos adicionales como objeto serializable para comparar.
  async getAdditionalDataSnapshot() {
    const [
      healthPlan,
      patientType,
      diagnosisConcept,
      floor,
      room,
      bed,
      group,
      indentNumber,
      portalObservations,
      temperature,
      processingDateAttendance,
      processingDateEstimatedDelivery,
      processingDateProcessing,
    ] = await Promise.all([
      this.helpers.getSelectedComboText(COMBO.ORDER.healthPlan),
      this._getPatientTypeText(),
      this.helpers.getFieldValue(this.page.getByLabel('Diagnóstico')),
      this.helpers.getFieldValue(this.page.locator(`#${LOCATION_FIELD.floor}`)),
      this.helpers.getFieldValue(this.page.locator(`#${LOCATION_FIELD.room}`)),
      this.helpers.getFieldValue(this.page.locator(`#${LOCATION_FIELD.bed}`)),
      this.helpers.getFieldValue(this.page.locator(`#${ORDER_FIELD.group}`)),
      this.helpers.getFieldValue(this.page.locator(`#${ORDER_FIELD.indentNumber}`)),
      this.helpers.getFieldValue(this.page.locator(`#${ORDER_FIELD.portalObservations}`)),
      this.helpers.getFieldValue(this.page.locator(`#${LOCATION_FIELD.temperature}`)),
      this.helpers.getFieldValue(this.page.locator(`#${DATE_FIELD.attendance}`)),
      this.helpers.getFieldValue(this.page.locator(`#${DATE_FIELD.estimatedDelivery}`)),
      this.helpers.getFieldValue(this.page.locator(`#${DATE_FIELD.processing}`)),
    ]);

    return {
      healthPlan,
      patientType,
      diagnosisConcept,
      floor,
      room,
      bed,
      group,
      indentNumber,
      portalObservations,
      temperature: parseFloat(temperature),
      processingDateAttendance,
      processingDateEstimatedDelivery,
      processingDateProcessing,
    };
  }

  // Se ancla en el contenedor, único identificador estable de este combo.
  async _getPatientTypeText() {
    const chip = this.page.locator(`#${ORDER_FIELD.patientTypeCombo} .vs__selected`).first();
    return ((await chip.textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  }
}
