import { expect } from '@playwright/test';
import { HelpersPage } from './helpers.page';
import { DEFAULT_INDENT } from '../data/test-data';
import { AGENDA, COMBO, DATE_FIELD, INDENT_FIELD, INDENT_LIST, LOCATION_FIELD, LOCATION_LABEL, LOOKUP, PATIENT } from '../data/selectors';
import { ROUTE, createPath, editPath, listPagePath, urlPattern } from '../data/routes';
import { TIMEOUT } from '../data/timeouts';
import { addDays, formatDateAsYYYYMMDD, nextWeekday } from '../utils/format.utils';


// La app pide la disponibilidad de la agenda a este endpoint cada vez que cambia la fecha de cita.
const AVAILABILITY_ENDPOINT = '/api/pedidos-disponibles';

export class IndentPage {
    /** @param {import('@playwright/test').Page} page */
    constructor(page) {
        this.page = page;
        this.helpers = new HelpersPage(page);
    }

    // Solo los delegados con llamador real; el resto se usa por this.helpers.*.
    selectFirstRowFromTableModal = (opts) => this.helpers.selectFirstRowFromTableModal(opts);
    openComboAndSelectFirstOption = (selector) => this.helpers.openComboAndSelectFirstOption(selector);
    dismissAllNotificationsIfPresent = () => this.helpers.dismissAllNotificationsIfPresent();
    // La verificación de que el paciente quedó vinculado ya vive en helpers.assertPatientCommitted().
    selectFirstPatient = () => this.helpers.selectFirstPatient();

    // Navega a /pedidos/create, espera el formulario y cierra notificaciones iniciales.
    async goto() {
        await this.page.goto(createPath(ROUTE.indents), { waitUntil: 'domcontentloaded' });
        await this.page.waitForURL(urlPattern.page(createPath(ROUTE.indents)), { timeout: TIMEOUT.NAVIGATION });
        await this.page.locator('form').first().waitFor({ state: 'visible', timeout: TIMEOUT.NAVIGATION });
        await this.helpers.dismissAllNotificationsIfPresent();
        await this.helpers.registerNotificationHandlers();
    }

    async selectFirstClient() {
        await this.openComboAndSelectFirstOption(COMBO.INDENT.client);
    }

    // Abre el modal de búsqueda de médico y selecciona el primer resultado.
    async selectFirstDoctor() {
        await this.helpers.waitForLoadingModal();
        await this.page.getByTitle(LOOKUP.openDoctor).click();
        await this.selectFirstRowFromTableModal({
            actionButton: LOOKUP.selectDoctorRow,
            postAssert: async () => {
                await expect(this.page.getByRole('textbox', { name: /Médico/i })).toHaveValue(/.+/);
            },
        });
    }

    // No es redundante con la búsqueda de cupo: sin fecha previa la app nunca pide la disponibilidad.
    async setAppointmentDateToToday() {
        await this.helpers.setDateToToday({ skipWeekends: true });
    }

    // Contador de cupos de la agenda para la fecha de cita elegida (el <div> hermano del label).
    availableSlots() {
        return this.page
            .locator('label.form-label')
            .filter({ hasText: this.helpers.labelRegex(AGENDA.availableSlotsLabel) })
            .first()
            .locator('xpath=following-sibling::div[1]');
    }

    // Con "Disponibles 0" la app deshabilita el guardado; requiere "Tipo atención" ya elegido.
    async setAppointmentDateToFirstAvailable() {
        const dateInput = this.page.locator(`#${DATE_FIELD.appointment}`);
        const slots = this.availableSlots();
        let date = nextWeekday(new Date());

        for (let attempt = 0; attempt < DEFAULT_INDENT.appointmentLookaheadDays; attempt++) {
            const formattedDate = formatDateAsYYYYMMDD(date);

            // El contador conserva el valor anterior mientras viaja el XHR: leerlo antes descarta días con cupo.
            const availability = this.page.waitForResponse(
                response => response.url().includes(AVAILABILITY_ENDPOINT)
                    && response.url().includes(`fecha_cita=${formattedDate}`),
                { timeout: TIMEOUT.RESPONSE },
            ).catch(() => null);

            await dateInput.fill(formattedDate);
            await dateInput.blur();
            await availability;

            if (((await slots.textContent()) || '').trim() !== '0') return formattedDate;

            date = nextWeekday(addDays(date, 1));
        }

        throw new Error(
            `No hay cupos de agenda en los próximos ${DEFAULT_INDENT.appointmentLookaheadDays} días hábiles ` +
            `desde ${formatDateAsYYYYMMDD(nextWeekday(new Date()))}: la agenda de staging está saturada.`
        );
    }

    // La búsqueda de cupo va entre medias: la disponibilidad solo se conoce tras elegir tipo atención.
    async selectContextCombos() {
        await this.openComboAndSelectFirstOption(COMBO.INDENT.careType);
        await this.setAppointmentDateToFirstAvailable();
        await this.openComboAndSelectFirstOption(COMBO.INDENT.service);
        await this.openComboAndSelectFirstOption(COMBO.INDENT.healthPlan);
    }

    // Rellena piso, sala, cama (si aplica) y temperatura con valores por defecto.
    async fillLocationAndVitals() {
        await this.page.locator(`#${LOCATION_FIELD.floor}`).fill(DEFAULT_INDENT.floor);
        await this.page.locator(`#${LOCATION_FIELD.room}`).fill(DEFAULT_INDENT.room);

        const bedInput = this.helpers.inputByLabel(LOCATION_LABEL.bed);
        if (await bedInput.isVisible().catch(() => false)) {
            await bedInput.fill(DEFAULT_INDENT.bed);
        }

        const temperatureInput = this.helpers.inputByLabel(LOCATION_LABEL.temperature);
        await expect(temperatureInput).toBeVisible();
        await temperatureInput.fill(DEFAULT_INDENT.temp);
    }

    async selectFirstDiagnosis() {
        await this.helpers.waitForLoadingModal();
        await this.page.getByTitle(LOOKUP.openDiagnosis).click();
        await this.selectFirstRowFromTableModal({
            actionButton: LOOKUP.selectRow,
        });
    }

    async fillObservations() {
        await this.page.locator(`#${INDENT_FIELD.observations}`).fill(DEFAULT_INDENT.observation);
    }

    // Clica el primer examen disponible en el buscador y cierra el listado.
    selectFirstExam = () => this.helpers.addFirstExam();

    // Lee todos los campos del pedido en pantalla y devuelve un snapshot serializable para comparar.
    async getIndentSnapshot() {
        // En /create hay <input id="identificacion">; en /edit la identificación es texto en #paciente-nombre.
        const identificationInput = this.page.locator(PATIENT.identificationInput);
        const patientNameColumns = this.page.locator(`${PATIENT.nameCard} .col-auto`);
        await patientNameColumns.first().waitFor({ state: 'attached', timeout: TIMEOUT.ELEMENT }).catch(() => { });

        let patientIdentification = await this.helpers.getFieldValue(identificationInput);
        if (!patientIdentification) {
            const identificationBadge = this.page.locator(`${PATIENT.nameCard} span:has(i.fa-id-card)`).first();
            const raw = (await identificationBadge.textContent().catch(() => '')) || '';
            patientIdentification = raw.replace(/\s+/g, ' ').trim();
        }

        const patientName = ((await patientNameColumns.first().textContent().catch(() => '')) || '')
            .replace(/\s+/g, ' ').trim();

        const client = await this.helpers.getSelectedComboText(COMBO.INDENT.client);
        const careType = await this.helpers.getSelectedComboText(COMBO.INDENT.careType);
        const service = await this.helpers.getSelectedComboText(COMBO.INDENT.service);
        const healthPlan = await this.helpers.getSelectedComboText(COMBO.INDENT.healthPlan);

        const appointmentDate = await this.helpers.getFieldValue(this.page.locator(`#${DATE_FIELD.appointment}`));
        const doctorName = await this.helpers.getFieldValue(this.page.getByRole('textbox', { name: /Médico/i }));

        const floor = await this.helpers.getFieldValue(this.page.locator(`#${LOCATION_FIELD.floor}`));
        const room = await this.helpers.getFieldValue(this.page.locator(`#${LOCATION_FIELD.room}`));
        const bed = await this.helpers.getFieldValue(this.helpers.inputByLabel(LOCATION_LABEL.bed));
        const temperature = parseFloat(
            await this.helpers.getFieldValue(this.helpers.inputByLabel(LOCATION_LABEL.temperature))
        );

        const observations = await this.helpers.getFieldValue(this.page.locator(`#${INDENT_FIELD.observations}`));
        const diagnosisConcept = await this.helpers.getFieldValue(this.page.locator(`#${INDENT_FIELD.diagnosisConcept}`));

        return {
            patientIdentification,
            patientName,
            client, careType, service, healthPlan,
            appointmentDate, doctorName,
            floor, room, bed, temperature,
            observations, diagnosisConcept
        };
    }


    // Guarda el pedido esperando un POST /pedidos exitoso y devuelve el ID (del body o del listado como fallback).
    async saveAndGetIndentId() {
        const saveButton = this.page.locator(`#${INDENT_FIELD.save}`);
        const isIndentPost = response => response.url().includes(ROUTE.indents) && response.request().method() === 'POST';

        // El form de pedido llega con el buscador de exámenes abierto: hay que cerrarlo antes de clicar.
        const { response, lastToast, attempts } = await this.helpers.clickSaveUntilPostSent(saveButton, {
            isPost: isIndentPost,
            formUrlPattern: urlPattern.page(createPath(ROUTE.indents)),
            pressEscapeFirst: true,
        });

        if (!response) {
            // Salimos del form sin respuesta → el submit funcionó: id desde el listado.
            if (!urlPattern.page(createPath(ROUTE.indents)).test(this.page.url())) {
                return await this.getTopListIndentId();
            }
            const errors = await this.page
                .locator('.invalid-feedback, .is-invalid ~ .invalid-feedback, .text-danger')
                .filter({ hasText: /.+/ })
                .allInnerTexts()
                .catch(() => []);
            const message = errors.filter(Boolean).slice(0, 5).join(' | ') || 'no visible messages — check required fields';
            const toast = lastToast ? ` [toast] ${lastToast}` : '';
            throw new Error(`POST ${ROUTE.indents} was never sent after ${attempts} attempts (validation blocked submit): ${message}${toast}`);
        }

        this.helpers.expectSuccessfulSave(response, ROUTE.indents);

        let indentId = '';
        try {
            const body = await response.json();
            const id = body?.id ?? body?.data?.id ?? body?.pedido?.id;
            if (id) indentId = String(id);
        } catch { /* respuesta no-JSON */ }

        await this.helpers.waitForLoadingModal();

        if (indentId) return indentId;
        return await this.getTopListIndentId();
    }

    // Devuelve el ID del pedido que ocupa la primera fila del listado.
    async getTopListIndentId() {
        await this.page.waitForURL(urlPattern.list(ROUTE.indents), { timeout: TIMEOUT.NAVIGATION });
        const listTable = this.page
            .getByRole('table')
            .filter({ has: this.page.getByRole('columnheader', { name: INDENT_LIST.idColumnHeader, exact: true }) })
            .first();

        await listTable.waitFor({ state: 'visible', timeout: TIMEOUT.NAVIGATION });

        const firstCell = listTable.locator('tbody tr').first().locator('td').first();
        await firstCell.waitFor({ state: 'visible', timeout: TIMEOUT.NAVIGATION });

        const raw = (await firstCell.innerText()).trim();
        const topId = (raw.match(/^\s*(\d+)/)?.[1]) || '';
        return topId;
    }

    // Navega al listado de pedidos en la página indicada y espera a que el spinner desaparezca.
    async gotoIndentList(pageNum = 1) {
        await this.page.goto(listPagePath(ROUTE.indents, pageNum), { waitUntil: 'domcontentloaded' });
        await this.page.waitForURL(urlPattern.listPage(ROUTE.indents, pageNum), { timeout: TIMEOUT.NAVIGATION });
        await this.helpers.waitForLoadingModal();
    }

    // Busca la fila de un pedido por ID recorriendo hasta maxPages páginas del listado.
    async findIndentRow(indentId, { maxPages = 3 } = {}) {
        for (let p = 1; p <= maxPages; p++) {
            if (p > 1) await this.gotoIndentList(p);
            const table = this.page.getByRole('table')
                .filter({ has: this.page.getByRole('columnheader', { name: INDENT_LIST.idColumnHeader, exact: true }) })
                .first();
            await table.waitFor({ state: 'visible', timeout: TIMEOUT.CONTENT });
            const rows = table.locator('tbody tr');
            const rowCount = await rows.count();
            for (let i = 0; i < rowCount; i++) {
                const text = (await rows.nth(i).locator('td').first().innerText().catch(() => '')).trim();
                if (text.replace(/\D/g, '') === String(indentId)) {
                    return rows.nth(i);
                }
            }
        }
        return null;
    }

    // Abre un pedido para edición navegando directo a /pedidos/{id}/edit (evita el frágil botón "Editar" del listado).
    async openIndentForEditById(indentId) {
        const idStr = String(indentId);
        await this.page.goto(editPath(ROUTE.indents, idStr), { waitUntil: 'domcontentloaded' });
        await this.page.waitForURL(urlPattern.edit(ROUTE.indents), { timeout: TIMEOUT.NAVIGATION });
        await expect(this.page.locator('.navbar-brand', { hasText: /Editar Pedido No\./i })).toBeVisible({ timeout: TIMEOUT.NAVIGATION });
        await this.helpers.waitForLoadingModal();
        // Los datos del paciente se hidratan por XHR: esperar a que la card tenga contenido.
        await expect(this.page.locator(`${PATIENT.nameCard} span:has(i.fa-id-card)`)).toHaveText(/\S/, { timeout: TIMEOUT.NAVIGATION });
        // Esperar a que los combos estabilicen su chip (en edición muestran primero el id crudo y luego la etiqueta).
        await this.helpers.waitForComboStableByLabel(COMBO.INDENT.careType);
        await this.helpers.waitForComboStableByLabel(COMBO.INDENT.service);
        await this.helpers.waitForComboStableByLabel(COMBO.INDENT.healthPlan);
    }

    // Convierte el pedido indicado en orden desde el listado y devuelve el número de orden creado.
    async createOrderFromTopRowAndGetOrderId(indentId) {
        await this.page.waitForURL(urlPattern.list(ROUTE.indents), { timeout: TIMEOUT.NAVIGATION });
        await this.helpers.waitForLoadingModal();

        const table = this.page.getByRole('table')
            .filter({ has: this.page.getByRole('columnheader', { name: INDENT_LIST.idColumnHeader, exact: true }) })
            .first();
        await table.waitFor({ state: 'visible', timeout: TIMEOUT.CONTENT });

        const rows = table.locator('tbody tr');
        let row = null;
        if (indentId) {
            const rowCount = await rows.count();
            for (let i = 0; i < rowCount; i++) {
                const text = (await rows.nth(i).locator('td').first().innerText().catch(() => '')).trim();
                if (text.replace(/\D/g, '') === String(indentId)) {
                    row = rows.nth(i);
                    break;
                }
            }
            // Bajo paralelismo "la primera fila" puede ser de otro worker: si el pedido propio no está, fallamos explícito.
            if (!row) {
                throw new Error(`Indent ${indentId} is not on the first page of the list; cannot safely convert to order.`);
            }
        } else {
            row = rows.first();
        }

        await row.waitFor({ state: 'visible', timeout: TIMEOUT.CONTENT });
        await row.scrollIntoViewIfNeeded();

        await this.helpers.dismissAllNotificationsIfPresent();
        await row.hover();

        const saveOrderButton = row.getByRole('button', { name: /^Guardar Orden$/ }).first();

        const saveOrderButtonVisible = await saveOrderButton.waitFor({ state: 'visible', timeout: TIMEOUT.BTN_VISIBLE }).then(() => true).catch(() => false);
        if (!saveOrderButtonVisible) {
            const statusCell = row.locator('td').nth(8);
            const status = (await statusCell.innerText().catch(() => '')).trim();
            throw new Error(`Indent ${indentId} has no visible "Guardar Orden" button (status: "${status}"). It may have been converted by another worker.`);
        }

        await saveOrderButton.scrollIntoViewIfNeeded();

        const [orderResponse] = await Promise.all([
            this.page.waitForResponse(
                response => /\/api\/pedidos\/\d+\/orden/.test(response.url()) && response.request().method() === 'POST',
                { timeout: TIMEOUT.RESPONSE_CONVERT },
            ),
            saveOrderButton.click(),
        ]);

        if (!orderResponse.ok()) {
            let detail = '';
            try { detail = (await orderResponse.json())?.message ?? JSON.stringify(await orderResponse.clone().json()); } catch { /* ignore */ }
            throw new Error(`Guardar Orden failed (${orderResponse.status()}) for indent ${indentId}: ${detail}`);
        }

        // El número visible de orden viene del enlace del toast (?cadenaBusqueda=...), no del id del body.
        const successToast = this.page.locator('div').filter({ hasText: /Orden\s+\d+\s+creada a partir del pedido/i }).first();
        await successToast.waitFor({ state: 'visible', timeout: TIMEOUT.CONTENT });
        const link = successToast.locator('a[href*="cadenaBusqueda"]').first();
        const href = await link.getAttribute('href').catch(() => null);
        const orderId = href?.match(/cadenaBusqueda=(\d+)/)?.[1]
            ?? (await successToast.innerText().catch(() => '')).match(/Orden\s+(\d+)/i)?.[1]
            ?? '';

        expect(orderId, 'Could not extract order number from success toast').toBeTruthy();
        return orderId;
    }
}
