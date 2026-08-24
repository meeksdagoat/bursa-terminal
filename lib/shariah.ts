import { mentionedCompanies } from "./universe";

/**
 * Helpers for the global "Shariah only" filter.
 *
 * News and filing feeds carry no ticker, so a story is resolved by the company
 * names it mentions. A story that names no universe member is kept: dropping
 * everything unattributable would empty the market wire, which is macro and
 * index coverage rather than coverage of a non-compliant business.
 */

export function textIsShariahSafe(text: string): boolean {
  const companies = mentionedCompanies(text);
  if (companies.length === 0) return true;
  return companies.every((company) => company.shariah);
}

export function shariahNote(count: number): string | null {
  if (count === 0) return null;
  return `${count} hidden by Shariah filter`;
}
