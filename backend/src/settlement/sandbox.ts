// Only new jobs on explicitly enabled non-production instances use test balances.
export function sandboxRate(): number | null {
  if (process.env.NODE_ENV === 'production' || process.env.MISTRI_WALLET_SANDBOX !== 'true')
    return null;
  const rate = Number(process.env.MISTRI_TEST_COMMISSION_BPS ?? 1000);
  if (!Number.isInteger(rate) || rate < 1000 || rate > 1500) {
    throw new Error('MISTRI_TEST_COMMISSION_BPS must be an integer between 1000 and 1500.');
  }
  return rate;
}
