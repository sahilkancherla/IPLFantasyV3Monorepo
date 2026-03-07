export type Currency = 'usd' | 'lakhs'

export function formatCurrency(amount: number, currency: Currency = 'lakhs'): string {
  if (currency === 'usd') {
    return `$${amount}`
  }
  return `₹${amount}L`
}
