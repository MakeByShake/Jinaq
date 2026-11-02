/**
 * Parser for Kaspi Gold statements (PDF exported from the Kaspi.kz app).
 * Row format:  "05.10.24  - 2 500,00 ₸  Покупки  Magnum Cash&Carry"
 * Works with Russian, Kazakh and English statements.
 */

export type OpType = 'purchase' | 'topup' | 'transfer' | 'withdrawal' | 'other';

export interface ParsedOp {
  key: string;
  date: string; // YYYY-MM-DD
  amount: number; // positive
  sign: 1 | -1;
  type: OpType;
  details: string;
}

export interface ParsedStatement {
  bank: 'kaspi';
  period?: { from: string; to: string };
  ops: ParsedOp[];
  /** Lines that looked like operations but could not be read (for diagnostics). */
  skipped: number;
}

// Note: \w / \b don't match Cyrillic in JS — use \p{L} with the "u" flag.
const TYPE_WORDS: [RegExp, OpType][] = [
  [/^(покупк\p{L}*|сатып\s*алу\p{L}*|purchases?)$/iu, 'purchase'],
  [/^(пополнени\p{L}*|толықтыру\p{L}*|replenishment|top-?ups?|deposits?)$/iu, 'topup'],
  [/^(перевод\p{L}*|аударым\p{L}*|transfers?)$/iu, 'transfer'],
  [/^(сняти\p{L}*|ақша\s*алу\p{L}*|withdrawals?|cash)$/iu, 'withdrawal'],
  [/^(разное|әртүрлі|others?|прочее)$/iu, 'other'],
];

const DATE = String.raw`(\d{2})\.(\d{2})\.(\d{2}|\d{4})`;
// date, sign, amount, rest
const ROW = new RegExp(String.raw`^${DATE}\s+([+\-−–])\s*([\d\s ]+(?:[.,]\d{1,2})?)\s*(?:₸|тг|KZT|T)?\s+(.+)$`, 'i');
const PERIOD = new RegExp(String.raw`${DATE}\s*(?:-|–|по|до|to)\s*${DATE}`, 'i');

function toISO(d: string, m: string, y: string) {
  const yyyy = y.length === 2 ? `20${y}` : y;
  return `${yyyy}-${m}-${d}`;
}

function parseAmount(s: string): number {
  return Number(s.replace(/[\s ]/g, '').replace(',', '.'));
}

function splitType(rest: string): { type: OpType; details: string } {
  const words = rest.trim().split(/\s+/);
  // Operation type is one or two words ("Покупки", "Ақша алу").
  for (const n of [2, 1]) {
    const head = words.slice(0, n).join(' ');
    const hit = TYPE_WORDS.find(([re]) => re.test(head));
    if (hit) return { type: hit[1], details: words.slice(n).join(' ').trim() };
  }
  return { type: 'other', details: rest.trim() };
}

const NOISE = /^(дата|күні|date|сумма|итого|баланс|доступно|выписка|страница|бет|page|kaspi\.kz|ао «kaspi|ао "kaspi|остаток|лимит|пополнения|переводы|покупки|снятия|разное|номер|карта|валюта|период)(?=\s|$|[:.,])/iu;
const PAGE = /(страница|бет|page)\s*\d+/iu;

export function parseKaspiStatement(lines: string[]): ParsedStatement {
  const ops: ParsedOp[] = [];
  let period: ParsedStatement['period'];
  let skipped = 0;

  for (const raw of lines) {
    const line = raw.replace(/ /g, ' ').trim();
    if (!period) {
      const p = line.match(PERIOD);
      if (p && /(период|кезең|period|выписка|с\s|from)/iu.test(line)) {
        period = { from: toISO(p[1], p[2], p[3]), to: toISO(p[4], p[5], p[6]) };
      }
    }
    const m = line.match(ROW);
    if (m) {
      const amount = parseAmount(m[5]);
      if (!Number.isFinite(amount) || amount <= 0) { skipped++; continue; }
      const { type, details } = splitType(m[6]);
      const date = toISO(m[1], m[2], m[3]);
      ops.push({
        key: `${date}|${m[4] === '+' ? '+' : '-'}|${amount}|${ops.length}`,
        date, amount, sign: m[4] === '+' ? 1 : -1, type, details,
      });
      continue;
    }
    if (/^\d{2}\.\d{2}\.\d{2}/.test(line)) { skipped++; continue; }
    // Wrapped continuation of the previous operation's details.
    const last = ops[ops.length - 1];
    if (last && line.length < 60 && !NOISE.test(line) && !PAGE.test(line) && !/₸|\d{2}\.\d{2}\.\d{2}/.test(line) && last.details.length < 80) {
      last.details = `${last.details} ${line}`.trim();
    }
  }

  if (!period && ops.length) {
    const dates = ops.map((o) => o.date).sort();
    period = { from: dates[0], to: dates[dates.length - 1] };
  }
  return { bank: 'kaspi', period, ops, skipped };
}
