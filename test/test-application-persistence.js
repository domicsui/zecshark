const {
  saveApplication,
  getApplicationByXId,
  getApplications,
  getApplicationMetrics,
  updateApplicationStatus,
  getApplicationsForExport
} = require('../server/services/supabase');

async function runApplicationPersistenceTests() {
  console.log('====================================================');
  console.log('WAITLIST APPLICATION PERSISTENCE & DEDUPLICATION TEST');
  console.log('====================================================');

  const testXId = 'test_x_' + Date.now();
  const testUsername = 'tester_' + Math.floor(Math.random() * 10000);
  const testWallet = '0x' + Math.random().toString(16).substring(2, 42).padEnd(40, '0');

  console.log(`\n1. Creating test application for @${testUsername} (x_id: ${testXId})...`);
  const saveResult = await saveApplication({
    xId: testXId,
    xUsername: testUsername,
    walletAddress: testWallet
  });

  console.log('Save result:', {
    success: saveResult.success,
    source: saveResult.source,
    id: saveResult.application?.id,
    application_code: saveResult.application?.application_code,
    status: saveResult.application?.status
  });

  if (!saveResult.success || !saveResult.application) {
    throw new Error('Failed to save application: ' + saveResult.error);
  }
  console.log('✓ Test application successfully created and persisted.');

  console.log('\n2. Testing duplicate prevention for the same X user ID...');
  const duplicateResult = await saveApplication({
    xId: testXId,
    xUsername: testUsername,
    walletAddress: '0x1111111111111111111111111111111111111111'
  });

  console.log('Duplicate save result:', {
    success: duplicateResult.success,
    isDuplicate: duplicateResult.isDuplicate,
    error: duplicateResult.error
  });

  if (duplicateResult.success && !duplicateResult.isDuplicate) {
    throw new Error('Duplicate application was not caught!');
  }
  console.log('✓ Duplicate application successfully prevented.');

  console.log('\n3. Testing getApplicationByXId...');
  const fetchedByX = await getApplicationByXId(testXId);
  console.log('Fetched application by X ID:', {
    found: !!fetchedByX,
    x_username: fetchedByX?.x_username,
    application_code: fetchedByX?.application_code
  });

  if (!fetchedByX || fetchedByX.x_id !== testXId) {
    throw new Error('getApplicationByXId failed to retrieve application.');
  }
  console.log('✓ getApplicationByXId verified.');

  console.log('\n4. Testing getApplications for Admin Panel...');
  const adminApps = await getApplications({ search: testUsername, page: 1, limit: 10 });
  console.log('Admin applications query result:', {
    total: adminApps.total,
    foundCount: adminApps.applications?.length,
    source: adminApps.source
  });

  const foundApp = adminApps.applications?.find(a => a.x_id === testXId);
  if (!foundApp) {
    throw new Error('Application not found in admin applications list!');
  }
  console.log('✓ Application present in admin applications list.');

  console.log('\n5. Testing application status update...');
  const appId = foundApp.id || foundApp.application_code;
  const updateRes = await updateApplicationStatus(appId, 'COMPLETED');
  console.log('Update status result:', updateRes);

  if (!updateRes.success) {
    throw new Error('updateApplicationStatus failed: ' + updateRes.error);
  }

  const reFetched = await getApplicationByXId(testXId);
  console.log('Re-fetched status:', reFetched?.status);
  if (reFetched?.status !== 'COMPLETED') {
    throw new Error('Application status was not updated!');
  }
  console.log('✓ Application status update verified.');

  console.log('\n6. Testing getApplicationMetrics...');
  const metrics = await getApplicationMetrics();
  console.log('Application metrics:', metrics);
  if (typeof metrics.totalRegisteredUsers !== 'number') {
    throw new Error('Invalid metrics response');
  }
  console.log('✓ Application metrics verified.');

  console.log('\n7. Testing getApplicationsForExport (CSV)...');
  const exportApps = await getApplicationsForExport();
  console.log(`Found ${exportApps.length} applications for CSV export.`);
  const exportFound = exportApps.find(a => a.x_id === testXId);
  if (!exportFound) {
    throw new Error('Application not found in export list!');
  }
  console.log('✓ CSV export query verified.');

  console.log('\n====================================================');
  console.log('ALL WAITLIST PERSISTENCE TESTS PASSED SUCCESSFULLY! ✓');
  console.log('====================================================');
}

runApplicationPersistenceTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Persistence test failed:', err);
    process.exit(1);
  });
