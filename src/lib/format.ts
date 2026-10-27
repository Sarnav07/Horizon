export function formatUnits(raw: string, decimals: number, fractionDigits = 4): string {
  if (!/^-?[0-9]+$/.test(raw) || !Number.isSafeInteger(decimals) || decimals < 0 || decimals > 36
    || !Number.isSafeInteger(fractionDigits) || fractionDigits < 0 || fractionDigits > 12) {
    throw new Error("Invalid amount");
  }
  const value = BigInt(raw);
  const scale = 10n ** BigInt(decimals);
  const whole = (value < 0n ? -value : value) / scale;
  const remainder = (value < 0n ? -value : value) % scale;
  const precision = Math.min(decimals, fractionDigits);
  const fraction = precision === 0 ? "" : (remainder / (10n ** BigInt(decimals - precision)))
    .toString().padStart(precision, "0").replace(/0+$/, "");
  const prefix = value < 0n ? "-" : "";
  return prefix + whole.toLocaleString("en-US") + (fraction ? "." + fraction : "");
}

export function formatMicroUsd(raw: string): string {
  const amount = formatUnits(raw, 6, 2);
  return amount.startsWith("-") ? "-$" + amount.slice(1) : "$" + amount;
}
