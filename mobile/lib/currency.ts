export type Currency = 'usd' | 'lakhs'

export function formatCurrency(amount: number, currency: Currency = 'lakhs'): string {
  if (currency === 'usd') {
    return `$${amount}`
  }
  return `₹${amount}L`
}

/** Pick the correct base price from a player object based on the league currency. */
export function playerBasePrice(
  player: { base_price: number; base_price_usd?: number },
  currency: Currency
): number {
  if (currency === 'usd') return player.base_price_usd ?? player.base_price
  return player.base_price
}
