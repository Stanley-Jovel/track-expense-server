// Display-time Merchant clustering (see GLOSSARY.md: Merchant). Raw motives
// carry card-feed noise — processor prefixes ("SQ *", "TST*"), store numbers,
// trailing "City ST" — that splits one merchant across several spellings and
// fragments every per-merchant total. This derives one canonical display name
// per motive; the sheet's motives are never modified.

// Known clusters whose variants aren't fixable by generic cleanup alone
// (e.g. "Amazon Mktpl*Z53IK", "Cvs/pharmacy #10331"). First match wins.
const CANONICAL: [RegExp, string][] = [
  [/trader joe/i, "Trader Joe's"],
  [/safeway/i, 'Safeway'],
  [/\bcvs\b|cvs\/pharmacy/i, 'CVS Pharmacy'],
  [/starbucks/i, 'Starbucks'],
  [/amazon|amzn/i, 'Amazon'],
  [/tacos chukis/i, 'Tacos Chukis'],
  [/nectar lounge/i, 'Nectar Lounge'],
  [/bklyn blend/i, 'BKLYN Blend'],
  [/h mart/i, 'H Mart'],
  [/sunstar vending/i, 'Sunstar Vending'],
  [/fedex office/i, 'FedEx Office'],
  [/add-a-ball/i, 'Add-a-Ball'],
  [/\bqfc\b/i, 'QFC'],
  [/\bmta\b/i, 'MTA'],
];

// Payment-processor prefixes: Square ("SQ *"), Toast ("TST*"), Lightspeed.
const PROCESSOR_PREFIX = /^(sq|tst|ls)\s?\*\s*/i;
// Trailing "<City> <ST>" tail, e.g. "H Mart Seattle WA". The city is kept to
// one word so a merchant name's own last word is never swallowed.
const CITY_STATE_TAIL = /\s+[a-z.'-]+\s+(wa|or|ca|ny|nj|tx|fl|il)\b.*$/i;
// Store numbers and whatever follows, e.g. "Fedex Office #736", "Starbucks 20088".
const STORE_NUMBER_TAIL = /\s+#?\d[\d-]*.*$/;
// "Brand*reference" suffixes, e.g. "Openpay*keki".
const STAR_REFERENCE_TAIL = /\*.*$/;

/** Canonical Merchant display name for a raw motive. */
export function merchantName(motive: string): string {
  for (const [pattern, name] of CANONICAL) {
    if (pattern.test(motive)) return name;
  }

  let name = motive
    .replace(PROCESSOR_PREFIX, '')
    .replace(CITY_STATE_TAIL, '')
    .replace(STORE_NUMBER_TAIL, '')
    .replace(STAR_REFERENCE_TAIL, '')
    .trim();

  // Over-stripped (e.g. a motive that was only digits): keep the raw motive.
  if (name.length < 3) name = motive.trim();

  // Manual entries are often lowercase free text ("groceries", "rent").
  return name.charAt(0).toUpperCase() + name.slice(1);
}
