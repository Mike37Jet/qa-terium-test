import { expect } from '@playwright/test';
import { TIMEOUT } from '../data/timeouts';
import { DATE_FIELD, EXAM, LOOKUP, MODAL, PATIENT, TOAST } from '../data/selectors';
import { formatDateAsYYYYMMDD, nextWeekday } from '../utils/format.utils';

// Playwright descarta un locatorHandler tras N disparos; 20 cubre las reapariciones de una corrida completa.
const HANDLER_TIMES = 20;

// Tope de exámenes a agregar por búsqueda: evita un bucle infinito si la lista nunca se agota.
const MAX_EXAMS_TO_ADD = 10;

// Un segundo intento cubre el click que se traga un overlay; más arriesgaría crear duplicados.
const SAVE_ATTEMPTS = 2;

export class HelpersPage {
    /** @param {import('@playwright/test').Page} page */
    constructor(page) { this.page = page; }

    // Regex que matchea el texto exacto del label (tolerando espacios y el asterisco de requerido).
    labelRegex(label) {
        const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`^\\s*${escaped}\\s*\\*?\\s*$`);
    }

    // Abre un modal de tabla, clica la primera fila y espera el cierre.
    async selectFirstRowFromTableModal({
        title,
        rowSelector = 'tbody tr',
        actionButton = 'button:has(i.fa-check), button[title*="Seleccionar" i]',
        postAssert,
    } = {}) {
        const modal = title
            ? this.page.locator(`div.modal-content:has(.modal-title:has-text("${title}"))`)
            : this.page.getByRole('dialog').last();

        await modal.waitFor({ state: 'visible', timeout: TIMEOUT.MODAL_SHOW });

        const firstRow = modal.locator(rowSelector).first();
        await firstRow.waitFor({ state: 'visible', timeout: TIMEOUT.ELEMENT });

        const buttonByAttribute = firstRow.locator(actionButton).first();
        const buttonByRole = firstRow.getByRole('button', { name: /seleccionar/i }).first();

        if (await buttonByAttribute.count()) {
            await buttonByAttribute.click();
        } else if (await buttonByRole.count()) {
            await buttonByRole.click();
        } else {
            await firstRow.click();
        }

        const closed = await modal.waitFor({ state: 'hidden', timeout: TIMEOUT.MODAL_SHOW }).then(() => true).catch(() => false);
        if (!closed) {
            const closeButton = modal.getByRole('button', { name: /cerrar|close/i }).first();
            if (await closeButton.count()) await closeButton.click().catch(() => null);
            await modal.waitFor({ state: 'hidden', timeout: TIMEOUT.BACKDROP_DETACH }).catch(() => null);
        }
        postAssert && (await postAssert());
    }

    // Clica el botón de búsqueda y selecciona la primera fila del modal resultante.
    async openLookupAndSelectFirstRow(searchSelector, { title, postAssert } = {}) {
        await this.page.locator(searchSelector).click();
        await this.selectFirstRowFromTableModal({ title, postAssert });
    }

    // Ancla en el label y sube al ancestro con el combobox; `visible` descarta homónimos ocultos.
    _vsContainerByLabel(label) {
        const regex = this.labelRegex(label);
        return this.page
            .locator('label, .form-label')
            .filter({ hasText: regex })
            .filter({ visible: true })
            .first()
            .locator('xpath=ancestor::*[.//*[@role="combobox"]][1]');
    }

    // Para los campos sin id/name/for (Cama, Temperatura): ancla en el texto del label.
    inputByLabel(label) {
        return this.page
            .locator('label, .form-label')
            .filter({ hasText: this.labelRegex(label) })
            .filter({ visible: true })
            .first()
            .locator('xpath=ancestor::*[.//input][1]')
            .locator('input')
            .first();
    }

    // Para SELECCIÓN: devuelve el [role=combobox] dentro del contenedor visible con ese label.
    comboByLabel(label) {
        return this._vsContainerByLabel(label).locator('[role="combobox"]').first();
    }

    // Espera a que el chip del combo (por LABEL) se estabilice: en edición muestra primero el id crudo y luego la etiqueta.
    async waitForComboStableByLabel(label, { timeout = TIMEOUT.COMBO_STABLE } = {}) {
        const chip = this._vsContainerByLabel(label).locator('.vs__selected').first();
        await chip.waitFor({ state: 'visible', timeout });
        await expect(chip).not.toHaveText(/^\s*\d+\s*$/, { timeout });
    }

    // Como comboByLabel pero sin exigir visibilidad, para leer combos en tabs inactivos (snapshots).
    comboByLabelForRead(label) {
        const regex = this.labelRegex(label);
        return this.page
            .locator('label, .form-label')
            .filter({ hasText: regex })
            .first()
            .locator('xpath=ancestor::*[.//*[@role="combobox"]][1]')
            .locator('[role="combobox"]')
            .first();
    }

    // Abre un combo y elige la primera opción, reintentando porque en webkit el click a veces no fija el chip.
    async openComboLocatorAndSelectFirst(combo, name, { retries = 2 } = {}, container) {
        await this.dismissAllNotificationsIfPresent();
        if ((await this.page.locator(`#${MODAL.patientSearch}.show`).count()) > 0) {
            await this.forceClosePatientModal();
        }
        await expect(combo).toBeVisible({ timeout: TIMEOUT.LISTBOX });
        await combo.scrollIntoViewIfNeeded().catch(() => { });

        for (let attempt = 0; attempt <= retries; attempt++) {
            const listbox = await this.openListboxFromCombo(combo);
            await listbox.getByRole('option').first().click();
            if (await this._isContainerCommitted(container)) return;
            await this.dismissAllNotificationsIfPresent();
        }
        throw new Error(`Combo "${name}" did not commit any option after ${retries + 1} attempts (vue-select commit flake).`);
    }

    async _isContainerCommitted(container) {
        const chip = container.locator('.vs__selected').first();
        try {
            await chip.waitFor({ state: 'visible', timeout: TIMEOUT.COMBO_COMMIT });
            return ((await chip.textContent().catch(() => '')) || '').trim().length > 0;
        } catch {
            return false;
        }
    }

    // Selecciona la primera opción de un combo identificado por su LABEL.
    async openComboAndSelectFirstOption(label, opts) {
        const container = this._vsContainerByLabel(label);
        const combo = container.locator('[role="combobox"]').first();
        await this.openComboLocatorAndSelectFirst(combo, label, opts, container);
    }

    // Recorre las opciones del combo (por LABEL) hasta dejar seleccionada una que habilite exámenes.
    async selectFirstComboOptionWithExams(label, examSelector = EXAM.resultRow) {
        const combo = this.comboByLabel(label);
        const listbox = await this.openListboxFromCombo(combo);
        const options = listbox.getByRole('option');
        const count = await options.count();

        for (let i = 0; i < count; i++) {
            await options.nth(i).click();

            const hasExams = await this.page.locator(examSelector).first()
                .waitFor({ state: 'visible', timeout: TIMEOUT.QUICK })
                .then(() => true).catch(() => false);

            if (hasExams) return;

            await this.openListboxFromCombo(combo);
        }

        throw new Error(`No se encontró ninguna opción en "${label}" con exámenes disponibles`);
    }

    // La aserción la decide el `type` real: los numéricos reformatean al blur y fallan por texto.
    async clearAndFillInput(selector, value) {
        const input = this.page.locator(selector);
        await input.waitFor({ state: 'visible' });
        await input.scrollIntoViewIfNeeded();
        await input.fill(String(value));
        await input.blur();

        const isNumeric = await input.evaluate(element => element.type === 'number');
        if (isNumeric) {
            await expect(input).toHaveJSProperty('valueAsNumber', Number(value));
        } else {
            await expect(input).toHaveValue(String(value));
        }
    }

    // Cambia de pestaña Bootstrap y espera a que el panel quede .active.show (sin esperar el fade, webkit deja paneles en blanco).
    async switchToTab(tabName) {
        const tab = this.page.getByRole('tab', { name: tabName }).first();
        await tab.scrollIntoViewIfNeeded().catch(() => { });
        await tab.click();

        const target = (await tab.getAttribute('href').catch(() => null))
            || (await tab.getAttribute('data-bs-target').catch(() => null));
        if (target && target.startsWith('#')) {
            const pane = this.page.locator(target);
            await pane.waitFor({ state: 'visible', timeout: TIMEOUT.CONTENT }).catch(() => null);
            await this.page.waitForFunction(
                (selector) => {
                    const element = document.querySelector(selector);
                    return !!element && element.classList.contains('active') && element.classList.contains('show');
                },
                target,
                { timeout: TIMEOUT.ELEMENT },
            ).catch(() => null);
        }
        await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: TIMEOUT.ELEMENT }).catch(() => null);
    }

    // Lanza la promesa ANTES del click: el aviso se auto-oculta y después ya no está.
    _captureToastText() {
        const toast = this.page.locator(TOAST);
        return toast.first().waitFor({ state: 'visible', timeout: TIMEOUT.TOAST })
            .then(async () => (await toast.allInnerTexts().catch(() => []))
                .map(text => text.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' | '))
            .catch(() => '');
    }

    // Camino ÚNICO para guardar (pedido u orden); `response === null` = no hubo POST y decide el llamador.
    async clickSaveUntilPostSent(saveButton, { isPost, formUrlPattern, pressEscapeFirst = false }) {
        let response = null;
        let lastToast = '';

        for (let attempt = 1; attempt <= SAVE_ATTEMPTS && !response; attempt++) {
            if (pressEscapeFirst) await this.page.keyboard.press('Escape').catch(() => null);
            // Cerrar solo modales bloqueantes (no los avisos) para no borrar la validación del intento anterior.
            await this.dismissBlockingModalsIfPresent();
            await this.waitForLoadingModal();
            await expect(saveButton).toBeVisible({ timeout: TIMEOUT.ELEMENT });
            await expect(saveButton).toBeEnabled({ timeout: TIMEOUT.ELEMENT });
            await saveButton.scrollIntoViewIfNeeded();

            const responsePromise = this.page.waitForResponse(isPost, { timeout: TIMEOUT.RESPONSE });
            const toastPromise = this._captureToastText();

            await saveButton.click();
            const [attemptResponse, toastText] = await Promise.all([responsePromise.catch(() => null), toastPromise]);
            response = attemptResponse;
            if (toastText) lastToast = toastText;

            // Sin POST pero fuera del form: un submit previo funcionó, no re-clicar (evita duplicados).
            if (!response && !formUrlPattern.test(this.page.url())) break;
        }

        return { response, lastToast, attempts: SAVE_ATTEMPTS };
    }

    // Verifica que el POST de guardado respondió 2xx.
    expectSuccessfulSave(response, label) {
        expect(
            response.status(),
            `POST ${label} failed with status ${response.status()} — check required fields`
        ).toBeGreaterThanOrEqual(200);
        expect(response.status()).toBeLessThan(300);
    }

    // `force` va al final a propósito: salta las comprobaciones y puede clicar otro elemento.
    async clickWithFallback(button) {
        try {
            await button.click({ trial: true, timeout: TIMEOUT.CLICK_TRIAL });
            await button.click();
            return;
        } catch { /* el elemento estaba tapado: limpiamos y reintentamos */ }

        await this.page.keyboard.press('Escape').catch(() => null);
        await button.scrollIntoViewIfNeeded();
        try {
            await button.click({ timeout: TIMEOUT.CLICK_RETRY });
        } catch {
            await button.click({ force: true });
        }
    }

    // Espera a que el modal global de "Cargando" desaparezca.
    async waitForLoadingModal() {
        await this.page.locator(`#${MODAL.loading}`).waitFor({ state: 'hidden', timeout: TIMEOUT.LOADING_MODAL }).catch(() => null);
    }

    // Hace click en el combo, espera el listbox con opciones y devuelve el locator del listbox.
    async openListboxFromCombo(combo) {
        await combo.click();
        const listbox = this.page.getByRole('listbox')
            .filter({ has: this.page.getByRole('option') })
            .first();
        await listbox.waitFor({ state: 'visible', timeout: TIMEOUT.LISTBOX });
        return listbox;
    }

    // Cierra un modal Bootstrap por id o selector usando su API y espera el cierre del backdrop.
    async closeBootstrapModal({ id, selector } = {}, { hideTimeout = TIMEOUT.MODAL_HIDE, waitDetach = true } = {}) {
        await this.page.evaluate(({ id, selector }) => {
            const element = id ? document.getElementById(id) : document.querySelector(selector);
            if (!element) return;
            const modalInstance = window.bootstrap?.Modal?.getInstance(element);
            if (modalInstance) {
                modalInstance.hide();
            } else {
                (element.querySelector('[data-bs-dismiss="modal"]') ?? element.querySelector('.btn-close') ?? element.querySelector('button'))?.click();
            }
        }, { id, selector });

        const modalLocator = id ? this.page.locator(`#${id}`) : this.page.locator(selector).first();
        await modalLocator.waitFor({ state: 'hidden', timeout: hideTimeout }).catch(() => null);
        if (waitDetach) {
            // .first(): en webkit hay 2 backdrops apilados → evita strict mode violation.
            await this.page.locator('.modal-backdrop').first().waitFor({ state: 'detached', timeout: TIMEOUT.BACKDROP_DETACH }).catch(() => null);
        }
    }

    // Elimina backdrops/clases huérfanas que quedan interceptando clics tras cerrar un modal. Idempotente.
    async clearStrayBackdrops() {
        await this.page.evaluate(() => {
            document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
            if (!document.querySelector('.modal.show')) {
                document.body.classList.remove('modal-open');
                document.body.style.removeProperty('padding-right');
                document.body.style.removeProperty('overflow');
            }
        }).catch(() => null);
        await this.page.locator('.modal-backdrop').first()
            .waitFor({ state: 'detached', timeout: TIMEOUT.BACKDROP_DETACH }).catch(() => null);
    }

    // Oculta por JS un modal Bootstrap (hide+dispose+ocultar nodo) ubicándolo por id o por texto, y limpia backdrops.
    async _forceHideModalJS({ id, textMatch } = {}) {
        await this.page.evaluate(({ id, textMatch }) => {
            const hide = (modalElement) => {
                const modalInstance = window.bootstrap?.Modal?.getInstance(modalElement);
                if (modalInstance) { try { modalInstance.hide(); } catch { /* ignore */ } try { modalInstance.dispose(); } catch { /* ignore */ } }
                modalElement.classList.remove('show');
                modalElement.setAttribute('aria-hidden', 'true');
                modalElement.style.display = 'none';
            };
            if (id) { const modalElement = document.getElementById(id); if (modalElement) hide(modalElement); }
            if (textMatch) {
                const textRegex = new RegExp(textMatch, 'i');
                for (const modalElement of document.querySelectorAll('.modal.show')) {
                    if (textRegex.test(modalElement.textContent || '')) hide(modalElement);
                }
            }
        }, { id, textMatch }).catch(() => null);
        await this.clearStrayBackdrops();
    }

    // Cierre ÚNICO de modales: por UI y, si no se oculta, forzado por JS. No-op si no está visible.
    async dismissModalIfPresent(modal, { id, textMatch, hideTimeout = TIMEOUT.MODAL_PROBE } = {}) {
        if (!(await modal.isVisible().catch(() => false))) return;

        const closeButton = modal.getByRole('button', { name: /^\s*cerrar\s*$/i }).first();
        if ((await closeButton.isVisible().catch(() => false)) && (await closeButton.isEnabled().catch(() => false))) {
            await closeButton.click({ force: true, timeout: TIMEOUT.QUICK }).catch(() => null);
        } else {
            await modal.locator('.btn-close, [data-bs-dismiss="modal"]').first()
                .click({ force: true, timeout: TIMEOUT.QUICK }).catch(() => null);
        }

        const hidden = await modal.waitFor({ state: 'hidden', timeout: hideTimeout })
            .then(() => true).catch(() => false);
        if (!hidden) await this._forceHideModalJS({ id, textMatch });
        else await this.clearStrayBackdrops();
    }

    // Modal "Aviso importante": no tiene id estable, se ubica por el encabezado (se usa también al registrar handlers).
    avisoImportanteModal() {
        return this.page.getByRole('dialog')
            .filter({ has: this.page.getByRole('heading', { name: new RegExp(MODAL.avisoImportante, 'i') }) })
            .first();
    }

    // Cierra el modal de notificaciones destacadas si está visible.
    async dismissHighlightedNotificationsIfPresent() {
        await this.dismissModalIfPresent(
            this.page.locator(`#${MODAL.highlightedNotifications}`),
            { id: MODAL.highlightedNotifications },
        );
    }

    // Cierra el modal "Aviso importante" (puede quedar en "Cargando…" bloqueando con su backdrop).
    async dismissAvisoImportanteIfPresent() {
        await this.dismissModalIfPresent(this.avisoImportanteModal(), { textMatch: MODAL.avisoImportante });
    }

    // Cierra toasts (el contenedor no es único, se acota con :has(.toast)).
    async dismissToastsIfPresent() {
        const container = this.page.locator('.position-fixed.end-0.pe-3.pt-3:has(.toast)').first();
        if (!(await container.isVisible().catch(() => false))) return;

        const closeButtons = container.locator('.toast .btn-close, .toast button[aria-label*="close" i]');
        const count = await closeButtons.count().catch(() => 0);
        for (let i = 0; i < count; i++) {
            await closeButtons.nth(i).click().catch(() => null);
        }

        await container.locator('.toast.show').first()
            .waitFor({ state: 'hidden', timeout: TIMEOUT.TOAST_HIDE }).catch(() => null);
    }

    // Cierra modales bloqueantes SIN tocar toasts (preserva el aviso de validación antes de un submit).
    async dismissBlockingModalsIfPresent() {
        await this.dismissAvisoImportanteIfPresent();
        await this.dismissHighlightedNotificationsIfPresent();
        await this.clearStrayBackdrops();
    }

    // Cierra toasts + modales en secuencia.
    async dismissAllNotificationsIfPresent() {
        await this.dismissToastsIfPresent();
        await this.dismissBlockingModalsIfPresent();
    }

    // Registra handlers que cierran notificaciones/avisos apenas aparezcan, incluso si surgen tras el goto inicial.
    async registerNotificationHandlers() {
        const handlers = [
            [this.page.locator(`#${MODAL.highlightedNotifications}.show`), () => this.dismissHighlightedNotificationsIfPresent()],
            [this.avisoImportanteModal(), () => this.dismissAvisoImportanteIfPresent()],
            [this.page.locator(`#${MODAL.pendingOrders}.show`), () => this.dismissPendingOrdersModal()],
        ];

        for (const [locator, dismiss] of handlers) {
            await this.page.addLocatorHandler(locator, dismiss, { noWaitAfter: true, times: HANDLER_TIMES });
        }
    }

    // Cierra el modal de "Pedidos/Cotizaciones pendientes" si está visible.
    async dismissPendingOrdersModal(hideTimeout = TIMEOUT.BACKDROP_DETACH) {
        await this.dismissModalIfPresent(
            this.page.locator(`#${MODAL.pendingOrders}`),
            { id: MODAL.pendingOrders, hideTimeout },
        );
    }

    // Devuelve el input-group que contiene el campo #identificacion del paciente.
    getPatientInputGroup() {
        return this.page.locator(`.input-group:has(${PATIENT.identificationInput})`).first();
    }

    // Clica el botón de búsqueda de paciente dentro del input-group.
    async openPatientSearch() {
        const searchButton = this.getPatientInputGroup().locator(LOOKUP.searchButtonInGroup).first();

        await expect(searchButton).toBeVisible({ timeout: TIMEOUT.ELEMENT });
        await this.waitForLoadingModal();
        await searchButton.click();
    }

    // Selecciona la primera fila del modal de paciente y espera/fuerza el cierre.
    async selectFirstPatientRow() {
        const patientModal = this.page.locator(`#${MODAL.patientSearch}`);
        await patientModal.waitFor({ state: 'visible', timeout: TIMEOUT.MODAL_SHOW });

        const selectButton = patientModal.locator(PATIENT.firstResultRow);
        await expect(selectButton).toBeVisible({ timeout: TIMEOUT.MODAL_SHOW });
        await selectButton.click();

        const closed = await patientModal.waitFor({ state: 'hidden', timeout: TIMEOUT.MODAL_HIDE })
            .then(() => true).catch(() => false);

        if (!closed) {
            await this.closeBootstrapModal({ id: MODAL.patientSearch }, { waitDetach: false });
        }
    }

    // Verifica que el paciente se vinculó: el input se llena al instante, pero la señal fiable es que la card #paciente-nombre tenga datos.
    async assertPatientCommitted() {
        await expect(this.page.locator(PATIENT.identificationInput)).toHaveValue(/.+/, { timeout: TIMEOUT.ELEMENT });
        await expect(this.getPatientInputGroup().locator('button').nth(1))
            .toBeEnabled({ timeout: TIMEOUT.MODAL_HIDE });
        // El vínculo real es que la card se hidrate (XHR); sin catch, para fallar aquí y no en el submit.
        await expect(this.page.locator(PATIENT.nameCard), 'El paciente no terminó de vincularse')
            .toHaveText(/\S{2,}/, { timeout: TIMEOUT.NAVIGATION });
    }

    // Cierre incondicional del modal de paciente: dispose Bootstrap + ocultar nodo + limpiar backdrops. Idempotente.
    async forceClosePatientModal() {
        await this._forceHideModalJS({ id: MODAL.patientSearch });
        await this.page.locator(`#${MODAL.patientSearch}.show`).waitFor({ state: 'detached', timeout: TIMEOUT.BACKDROP_DETACH }).catch(() => null);
    }

    // Orquesta la selección del primer paciente: abrir buscador, elegir fila, confirmar commit y cerrar reaperturas.
    async selectFirstPatient() {
        await this.openPatientSearch();
        await this.selectFirstPatientRow();
        await this.assertPatientCommitted();
        // Forzar el cierre solo si el modal quedó/reabrió visible: forzarlo siempre interrumpe la vinculación async en webkit.
        if ((await this.page.locator(`#${MODAL.patientSearch}.show`).count()) > 0) {
            await this.forceClosePatientModal();
        }
    }

    // Rellena un input de fecha con hoy; skipWeekends avanza al lunes (una cita en finde deshabilita #crearPedido).
    async setDateToToday({ dateFieldId = DATE_FIELD.appointment, skipWeekends = false } = {}) {
        const today = new Date();
        const date = skipWeekends ? nextWeekday(today) : today;

        const dateInput = this.page.locator(`#${dateFieldId}`);
        await expect(dateInput).toBeVisible({ timeout: TIMEOUT.ELEMENT });
        await dateInput.fill(formatDateAsYYYYMMDD(date));
        await dateInput.blur();
    }

    // Lee el valor de un campo (input o nodo de texto) como string limpio; devuelve "" si no existe (sin esperar 30s).
    async getFieldValue(locator) {
        try {
            if ((await locator.count()) === 0) return '';

            return await locator.first().evaluate((element) => {
                const isFormField = 'value' in element && element.value != null;
                if (isFormField) {
                    const elementValue = element.value;
                    return String(elementValue ?? '').trim();
                }
                const nodeTextContent = element.textContent;
                return String(nodeTextContent ?? '').trim();
            });
        } catch (error) {
            if (process.env.DEBUG) {
                console.warn('getFieldValue error:', error?.message || error);
            }
            return '';
        }
    }

    // Devuelve el texto de la opción seleccionada del combo (por LABEL), con fallback al input de búsqueda.
    async getSelectedComboText(label) {
        try {
            const combo = this.comboByLabelForRead(label);
            const root = combo.locator('xpath=ancestor-or-self::*[contains(@class,"v-select")][1]');

            const selectedChip = root.locator('.vs__selected, .vs__selected-options .vs__selected').first();
            await selectedChip.waitFor({ state: 'visible', timeout: TIMEOUT.COMBO_CHIP }).catch(() => null);
            if ((await selectedChip.count()) > 0) {
                const cleanedText = ((await selectedChip.textContent()) ?? '').trim();
                if (cleanedText) return cleanedText;
            }

            const searchInput = root.locator('.vs__search').first();
            if ((await searchInput.count()) > 0) {
                return ((await searchInput.inputValue()) ?? '').trim();
            }
            return '';
        } catch (error) {
            if (process.env.DEBUG) console.warn('getSelectedComboText error:', error?.message || error);
            return '';
        }
    }

    // Camino ÚNICO para agregar exámenes; sin `query` usa la lista ya cargada. Devuelve cuántos agregó.
    async addExamsFromSearch({ query, max = MAX_EXAMS_TO_ADD, minRequired = 0 } = {}) {
        const search = this.page.locator(EXAM.searchInput).first();
        await search.waitFor({ state: 'visible', timeout: TIMEOUT.CONTENT });
        if (query !== undefined) {
            await search.click();
            await search.fill(query);
        }

        let added = 0;
        for (let i = 0; i < max; i++) {
            const firstResult = this.page.locator(EXAM.resultRow).first();
            try {
                await firstResult.waitFor({ state: 'visible', timeout: TIMEOUT.EXAM_RESULT });
            } catch {
                break;
            }
            const previousResultText = ((await firstResult.textContent().catch(() => '')) || '').trim();
            await firstResult.click();
            added++;
            if (added >= max) break; // ya no vamos a clicar más: no hace falta esperar el refresco
            // Esperar a que la lista se actualice (el examen agregado sale y cambia el primer resultado) en vez de un sleep fijo.
            await this.page.waitForFunction(
                ({ previousText, selector }) => {
                    const element = document.querySelector(selector);
                    return !element || (element.textContent || '').trim() !== previousText;
                },
                { previousText: previousResultText, selector: EXAM.resultRow },
                { timeout: TIMEOUT.LIST_REFRESH },
            ).catch(() => null);
        }
        await this.page.keyboard.press('Escape').catch(() => null);

        if (minRequired > 0) {
            expect(added, `Se esperaban al menos ${minRequired} exámenes y se agregaron ${added}`)
                .toBeGreaterThanOrEqual(minRequired);
        }
        return added;
    }

    // Con la query por defecto suele agregar 1: staging solo tiene un examen que empiece por "EX".
    async addExamsByQuery(query = 'EX') {
        return this.addExamsFromSearch({ query });
    }

    // Agrega el primer examen de la lista ya cargada; falla si no hay ninguno.
    async addFirstExam() {
        return this.addExamsFromSearch({ max: 1, minRequired: 1 });
    }
}
