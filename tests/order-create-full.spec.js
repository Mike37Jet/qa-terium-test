import { test, expect } from '@playwright/test';
import { OrderPage } from './pages/order.page';
import { DEFAULT_ORDER } from './data/test-data';
import { COMBO } from './data/selectors';
import { TIMEOUT } from './data/timeouts';
import { omitKeys } from './utils/snapshot.utils';

test.setTimeout(TIMEOUT.TEST_LONG);

// patientName se excluye porque en /edit sale de la card, no del input: se valida con toBeTruthy.
const FIELDS_NOT_COMPARED_ON_REOPEN = ['patientName'];

test('Create an order with all options', async ({ page }) => {
  const order = new OrderPage(page);

  await test.step('Go to create order', async () => {
    await order.goto();
    await order.dismissAllNotificationsIfPresent();
  });

  const addedExamCount = await test.step('Fill general data', async () => {
    await order.selectFirstPatient();
    await order.dismissPendingOrdersModal();
    await order.openComboAndSelectFirstOption(COMBO.ORDER.client);
    await order.selectDoctor();
    await order.selectFirstComboOptionWithExams(COMBO.ORDER.careType);
    await order.fillObservations();
    await order.openComboAndSelectFirstOption(COMBO.ORDER.service);
    await order.selectPhlebotomist();

    const sampleDeliveryField = page.getByLabel('Persona entrega muestra');
    await expect(sampleDeliveryField, 'Input "Persona entrega muestra" not visible').toBeVisible();
    await sampleDeliveryField.fill(DEFAULT_ORDER.sampleDelivery);
    await order.selectDeliveryMethods();

    const count = await order.addExamsByQuery('EX');
    expect(count, 'No exams were added').toBeGreaterThan(0);

    await order.fillTotals();
    return count;
  });

  await test.step('Fill additional data', async () => {
    await order.fillAdditionalData();
    await order.fillSigns();
  });

  await test.step('Fill processing dates (date + time)', async () => {
    await order.fillProcessingDates();
  });

  await test.step('Fill billing data', async () => {
    await order.fillBillingData();
  });

  // Leer el total tras llenar todo: algunos campos (p.ej. Plan salud) recalculan el total en el servidor.
  const totalOnCreate = await test.step('Obtain the total value of the order', async () => {
    const { value } = await order.getTotalOnCreateForm();
    expect(Number.isFinite(value), 'The total on creation is not numeric').toBe(true);
    return value;
  });

  // Snapshot del formulario antes de guardar.
  const preSaveSnapshot = await test.step('Capture pre-save form snapshot', async () => {
    const general = await order.getGeneralDataSnapshot();
    await order.openAdditionalDataTab();
    const additional = await order.getAdditionalDataSnapshot();
    const billing = await order.getBillingSnapshot();
    return { ...general, ...additional, billing };
  });

  const orderId = await test.step('Save and get order ID', async () => {
    const id = await order.saveAndGetOrderId();
    expect(id, 'Order number can not be obtained').toBeTruthy();
    return id;
  });

  await test.step('Compare the order id and the total value in the order list', async () => {
    await order.gotoOrdersList(1);
    const row = await order.findOrderRow(orderId);
    expect(row, `The order ${orderId} can not be found in the list`).not.toBeNull();

    const { value: listTotal } = await order.getListTotalFromRow(row);
    expect(listTotal, 'The total in the list is not numeric').toBeGreaterThanOrEqual(0);
    expect(listTotal).toBeCloseTo(totalOnCreate, 2);

    test.info().annotations.push({ type: 'order-total', description: `Order ${orderId}: creation=${totalOnCreate} | list=${listTotal}` });
  });

  await test.step('Reopen saved order and assert persisted data matches form snapshot', async () => {
    await order.openOrderForEditById(orderId);
    const general = await order.getGeneralDataSnapshot();
    await order.openAdditionalDataTab();
    const additional = await order.getAdditionalDataSnapshot();
    const billing = await order.getBillingSnapshot();
    const postSaveSnapshot = { ...general, ...additional, billing };

    expect(postSaveSnapshot.patientName, 'Patient empty in saved order').toBeTruthy();

    expect(
      omitKeys(postSaveSnapshot, FIELDS_NOT_COMPARED_ON_REOPEN),
      'The reopened order does not match the form snapshot',
    ).toEqual(omitKeys(preSaveSnapshot, FIELDS_NOT_COMPARED_ON_REOPEN));
  });

  await test.step('Open order detail and verify exam count persisted', async () => {
    await order.openOrderDetailById(orderId);
    const badgeCount = await order.getDetailExamCount();
    const rowCount = await order.getDetailExamRowCount();
    expect(badgeCount, `Badge "Cantidad" shows ${badgeCount}, tr.examen rows: ${rowCount}`).toBe(rowCount);
    expect(badgeCount, `Detail shows ${badgeCount} exams but ${addedExamCount} were added`).toBe(addedExamCount);
  });

});
