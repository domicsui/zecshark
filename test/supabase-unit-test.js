const { formatSettings } = require('../server/services/supabase');

console.log('Testing formatSettings normalization:');
const test1 = formatSettings({
  waitlist_enabled: false,
  applications_open: 'false',
  wallet_checker_enabled: true
});
console.log('Boolean normalization:', {
  waitlist_enabled: test1.waitlist_enabled,
  isWaitlistEnabled: test1.isWaitlistEnabled,
  applications_open: test1.applications_open,
  isApplicationsEnabled: test1.isApplicationsEnabled,
  wallet_checker_enabled: test1.wallet_checker_enabled,
  isWalletCheckerEnabled: test1.isWalletCheckerEnabled
});

if (test1.isWaitlistEnabled !== false || test1.isApplicationsEnabled !== false || test1.isWalletCheckerEnabled !== true) {
  throw new Error('formatSettings failed normalization!');
}
console.log('✓ formatSettings normalization verified');
