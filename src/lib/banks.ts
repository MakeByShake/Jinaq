import type { AccountType } from './types';

/**
 * Banks of Kazakhstan shown in the "add account" picker.
 * Logos are the banks' own site icons (public/banks/*.png), used only to label
 * the user's own accounts. Colors are approximate brand colors for card visuals.
 */
export interface Bank {
  id: string;
  name: string;
  /** Short label for tight grids. */
  short?: string;
  logo: string;
  /** Card gradient: from → to. */
  colors: [string, string];
  /** Suggested account names per type (first one is the default). */
  products: Partial<Record<AccountType, string[]>>;
}

export const BANKS: Bank[] = [
  {
    id: 'kaspi', short: 'Kaspi', name: 'Kaspi Bank', logo: '/banks/kaspi.png', colors: ['#F14635', '#B8231A'],
    products: { card: ['Kaspi Gold'], deposit: ['Kaspi Депозит'], savings: ['Kaspi Депозит'], credit: ['Kaspi Red', 'Kaspi Кредит'] },
  },
  {
    id: 'halyk', short: 'Halyk', name: 'Halyk Bank', logo: '/banks/halyk.png', colors: ['#0F8A63', '#075B41'],
    products: { card: ['Halyk Bonus', 'Halyk карта'], deposit: ['Halyk Депозит'], savings: ['Halyk Копилка'], credit: ['Halyk Кредит'] },
  },
  {
    id: 'freedom', short: 'Freedom', name: 'Freedom Bank', logo: '/banks/freedom.png', colors: ['#3EAA45', '#1F6E2C'],
    products: { card: ['Freedom Card'], deposit: ['Freedom Депозит'], savings: ['Freedom Депозит'], credit: ['Freedom Кредит'] },
  },
  {
    id: 'jusan', short: 'Jusan', name: 'Jusan Bank', logo: '/banks/jusan.png', colors: ['#F2A51A', '#D9730D'],
    products: { card: ['Jusan Card'], deposit: ['Jusan Депозит'], savings: ['Jusan Депозит'], credit: ['Jusan Кредит'] },
  },
  {
    id: 'bcc', short: 'BCC', name: 'Bank CenterCredit', logo: '/banks/bcc.png', colors: ['#1F4E8C', '#0E2E5C'],
    products: { card: ['#картакарта'], deposit: ['BCC Депозит'], savings: ['BCC Депозит'], credit: ['BCC Кредит'] },
  },
  {
    id: 'forte', short: 'Forte', name: 'ForteBank', logo: '/banks/forte.png', colors: ['#8C1D40', '#4E0A22'],
    products: { card: ['ForteBlack', 'Forte карта'], deposit: ['Forte Депозит'], savings: ['Forte Депозит'], credit: ['Forte Кредит'] },
  },
  {
    id: 'homecredit', short: 'Home Credit', name: 'Home Credit Bank', logo: '/banks/homecredit.png', colors: ['#E30613', '#9D0410'],
    products: { card: ['Home Credit карта'], deposit: ['Home Депозит'], savings: ['Home Депозит'], credit: ['Home Credit Кредит'] },
  },
  {
    id: 'bereke', short: 'Bereke', name: 'Bereke Bank', logo: '/banks/bereke.png', colors: ['#1C5BF0', '#0FA35C'],
    products: { card: ['Bereke карта'], deposit: ['Bereke Депозит'], savings: ['Bereke Депозит'], credit: ['Bereke Кредит'] },
  },
  {
    id: 'eurasian', short: 'Евразийский', name: 'Евразийский банк', logo: '/banks/eurasian.png', colors: ['#A6192E', '#650E1B'],
    products: { card: ['Eurasian карта'], deposit: ['Eurasian Депозит'], savings: ['Eurasian Депозит'], credit: ['Eurasian Кредит'] },
  },
  {
    id: 'rbk', short: 'RBK', name: 'Bank RBK', logo: '/banks/rbk.png', colors: ['#1B2A4A', '#2BB9C8'],
    products: { card: ['RBK карта'], deposit: ['RBK Депозит'], savings: ['RBK Депозит'], credit: ['RBK Кредит'] },
  },
  {
    id: 'altyn', short: 'Altyn', name: 'Altyn Bank', logo: '/banks/altyn.png', colors: ['#B31B1B', '#6E0F0F'],
    products: { card: ['Altyn карта'], deposit: ['Altyn Депозит'], savings: ['Altyn Депозит'], credit: ['Altyn Кредит'] },
  },
  {
    id: 'otbasy', short: 'Отбасы', name: 'Отбасы банк', logo: '/banks/otbasy.png', colors: ['#0072BC', '#004A7C'],
    products: { deposit: ['Отбасы Депозит'], savings: ['Отбасы Депозит'], credit: ['Отбасы Заём'], card: ['Отбасы карта'] },
  },
  {
    id: 'shinhan', short: 'Shinhan', name: 'Shinhan Bank', logo: '/banks/shinhan.png', colors: ['#0046FF', '#002A99'],
    products: { card: ['Shinhan карта'], deposit: ['Shinhan Депозит'], savings: ['Shinhan Депозит'], credit: ['Shinhan Кредит'] },
  },
  {
    id: 'nurbank', short: 'Нурбанк', name: 'Нурбанк', logo: '/banks/nurbank.png', colors: ['#0A6FC2', '#F2B705'],
    products: { card: ['Нурбанк карта'], deposit: ['Нурбанк Депозит'], savings: ['Нурбанк Депозит'], credit: ['Нурбанк Кредит'] },
  },
];

export const BANK_MAP = new Map(BANKS.map((b) => [b.id, b]));

export function getBank(id?: string): Bank | undefined {
  return id ? BANK_MAP.get(id) : undefined;
}

/** Default account name for a bank + type, e.g. Kaspi + card → "Kaspi Gold". */
export function suggestName(bank: Bank, type: AccountType): string {
  return bank.products[type]?.[0] ?? bank.name;
}
