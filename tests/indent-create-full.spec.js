
import { test, expect } from '@playwright/test';
import { IndentPage } from './pages/indent.page';
import { omitKeys } from './utils/snapshot.utils';

// patientIdentification se excluye porque en /edit sale del badge de la card, con otro formato.
const FIELDS_NOT_COMPARED_ON_REOPEN = ['patientIdentification'];

test('Create indent and verify it appears first in list', async ({ page }) => {
  const indent = new IndentPage(page);

  await test.step('Go to create indent', async () => {
    await indent.goto();
    await indent.dismissAllNotificationsIfPresent();
  });

  await test.step('Fill indent form', async () => {
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

  const indentSnapshot = await test.step('Snapshot before save', async () => {
    const snapshot = await indent.getIndentSnapshot();
    test.info().annotations.push({ type: 'indent-snapshot', description: JSON.stringify(snapshot) });
    return snapshot;
  });

  const indentId = await test.step('Save and capture indent ID', async () => {
    const id = await indent.saveAndGetIndentId();
    expect(id, 'Indent ID should be present after save').toBeTruthy();
    return id;
  });

  await test.step('Assert top row equals created indent', async () => {
    const topId = await indent.getTopListIndentId();
    expect(topId).toBe(String(indentId));
  });

  await test.step('Reopen saved indent and assert persisted data matches form snapshot', async () => {
    await indent.openIndentForEditById(indentId);
    const postSaveSnapshot = await indent.getIndentSnapshot();

    expect(postSaveSnapshot.patientIdentification, 'Identification empty in saved indent').toBeTruthy();

    expect(
      omitKeys(postSaveSnapshot, FIELDS_NOT_COMPARED_ON_REOPEN),
      'The reopened indent does not match the form snapshot',
    ).toEqual(omitKeys(indentSnapshot, FIELDS_NOT_COMPARED_ON_REOPEN));
  });

  test.info().annotations.push({ type: 'indent-id', description: `Indent created and verified: ${indentId}` });
});
