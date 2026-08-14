// Every dollar amount in the app used to render as a bare number
// ("400.00") with no currency symbol, which is only fine if every
// contractor using this happens to be in the US. formatMoney() and a
// small picker list fix that — the code (USD, GBP, ...) is the one thing
// the user chooses; the actual symbol/decimal/grouping conventions come
// from Intl.NumberFormat using their own browser locale, so "$1,234.56"
// vs "1.234,56 $" etc. is never something we have to get right by hand.

export const CURRENCIES = [
  { code: "USD", label: "US Dollar — $" },
  { code: "GBP", label: "British Pound — £" },
  { code: "EUR", label: "Euro — €" },
  { code: "CAD", label: "Canadian Dollar — C$" },
  { code: "AUD", label: "Australian Dollar — A$" },
  { code: "NZD", label: "New Zealand Dollar — NZ$" },
];

const DEFAULT_CURRENCY = "USD";

// A locale like "en-GB" or "de-DE" is a reasonable hint for which of the
// six currencies above a first-time user probably wants, without ever
// silently applying a currency they didn't choose — this only feeds the
// initial value of the picker, which the user can freely change.
export function guessDefaultCurrency() {
  try {
    const locale = Intl.NumberFormat().resolvedOptions().locale || "";
    const region = locale.split("-")[1];
    const byRegion = {
      GB: "GBP", US: "USD", CA: "CAD", AU: "AUD", NZ: "NZD",
      DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", IE: "EUR", NL: "EUR", PT: "EUR",
    };
    return byRegion[region] || DEFAULT_CURRENCY;
  } catch {
    return DEFAULT_CURRENCY;
  }
}

export function formatMoney(amount, currency) {
  const n = Number(amount) || 0;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || DEFAULT_CURRENCY }).format(n);
  } catch {
    return n.toFixed(2);
  }
}
