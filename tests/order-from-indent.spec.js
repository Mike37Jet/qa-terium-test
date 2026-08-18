import { test, expect } from '@playwright/test';
import { IndentPage } from './pages/indent.page';
import { OrderPage } from './pages/order.page';

test('Indent → create order → verify in list (first row) → open edit and compare data', async ({ page }) => {
    const indent = new IndentPage(page);
    const order = new OrderPage(page);

    await test.step('Create indent with all data', async () => {
        await indent.goto();
        await indent.dismissAllNotificationsIfPresent();
        await indent.selectFirstPatient();
        await indent.selectFirstClient();
        await indent.selectFirstDoctor();
        await indent.setAppointmentDateToToday();
        await indent.selectContextCombos();
        await indent.fillLocationAndVitals();
        await indent.selectFirstDiagnosis();
        await indent.fillObservations();
        await indent.selectFirstExam();
    });

    const indentSnapshot = await test.step('Snapshot of indent (before save)', async () => {
        return await indent.getIndentSnapshot();
    });

    const indentId = await test.step('Save indent and capture ID', async () => {
        const id = await indent.saveAndGetIndentId();
        expect(id).toBeTruthy();
        return id;
    });

    const orderIdFromAlert = await test.step('Create order from first row of indent list', async () => {
        await indent.dismissAllNotificationsIfPresent();
        const createdOrderId = await indent.createOrderFromTopRowAndGetOrderId(indentId);
        expect(createdOrderId).toBeTruthy();
        return createdOrderId;
    });

    await test.step('Go to order list and verify newly created order exists', async () => {
        await order.gotoOrdersList(1);
        const row = await order.findOrderRow(orderIdFromAlert);
        expect(row, `Order ${orderIdFromAlert} was not found in the list`).not.toBeNull();
    });

    await test.step('Go to order detail and verify data matches indent snapshot', async () => {
        await order.openOrderForEditById(orderIdFromAlert);
        const generalData = await order.getGeneralDataSnapshot();

        await order.openAdditionalDataTab();
        const extraData = await order.getAdditionalDataSnapshot();

        const orderSnapshot = { ...generalData, ...extraData };
        expect(orderSnapshot.patientName, 'Patient empty in order').toBeTruthy();
        expect(orderSnapshot.client).toBe(indentSnapshot.client);
        expect(orderSnapshot.careType).toBe(indentSnapshot.careType);
        expect(orderSnapshot.service).toBe(indentSnapshot.service);
        expect(orderSnapshot.healthPlan).toBe(indentSnapshot.healthPlan);
        expect(orderSnapshot.doctorName).toBe(indentSnapshot.doctorName);
        expect(orderSnapshot.diagnosisConcept).toBe(indentSnapshot.diagnosisConcept);
        expect(orderSnapshot.floor).toBe(indentSnapshot.floor);
        expect(orderSnapshot.room).toBe(indentSnapshot.room);
        expect(orderSnapshot.bed).toBe(indentSnapshot.bed);
        expect(orderSnapshot.temperature).toBe(indentSnapshot.temperature);
    });
});