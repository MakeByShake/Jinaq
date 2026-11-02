import type { MerchantRule } from '../types';
import type { OpType } from './kaspi';

/** Normalizes a merchant name for rule matching: "ИП «Ахметов А.» 123" → "ахметов а". */
export function merchantKey(details: string): string {
  return details
    .toLowerCase()
    .replace(/[«»"'`]/g, ' ')
    .replace(/(^|\s)(ип|тоо|ао|llp|ltd|kz)(?=\s|$)/gu, ' ')
    .replace(/[0-9*#№]+/g, ' ')
    .replace(/[^\p{L}\s&.-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

// Built-in keyword → category key (see src/lib/defaults.ts). First match wins.
const KEYWORDS: [RegExp, string][] = [
  [/magnum|small\b|смолл|galmart|анвар|anvar|toimart|арбуз|arbuz|metro|ramstore|минимаркет|продукт|супермаркет|market|маркет|dixy|fix price/iu, 'groceries'],
  [/yandex[\s.]*go|яндекс[\s.]*go|uklon|indrive|indriver|такси|taxi|bolt/iu, 'taxi'],
  [/onay|оңай|автобус|метро|транспорт|avtobys|авиабилет|air\s?astana|scat|fly\s?arystan|ктж|temir/iu, 'transport'],
  [/wolt|glovo|choco[\s.]*food|яндекс[\s.]*еда|yandex[\s.]*eda|starbucks|coffee|кофе|кафе|cafe|burger|kfc|mcdonald|hardee|dodo|pizza|пицц|ресторан|restaurant|bar\b|шаурм|donerci|salam bro/iu, 'cafe'],
  [/beeline|билайн|kcell|activ|tele2|altel|izi|казахтелеком|kazakhtelecom|интернет|internet/iu, 'mobile'],
  [/netflix|spotify|youtube|apple\.com|itunes|google|yandex\s*plus|яндекс\s*плюс|kinopoisk|кинопоиск|ivi\b|okko|chatgpt|openai|icloud|playstation|steam/iu, 'subscriptions'],
  [/аптек|apteka|pharm|biosfera|europharma|sadykhan|садыхан|клиник|clinic|med|стомат|dental|анализ|invitro|олимп|kdl/iu, 'health'],
  [/zara|lc\s?waikiki|h&m|bershka|pull&bear|lamoda|wildberries|ozon|adidas|nike|reserved|koton|defacto|обув|одежд/iu, 'clothes'],
  [/technodom|техно|sulpak|сулпак|mechta|мечта|ikea|leroy|леруа|home\s*center|kaspi\s*магазин/iu, 'home_goods'],
  [/kinopark|кинопарк|chaplin|чаплин|cinema|кино|bowling|боулинг|игр|game|steam/iu, 'fun'],
  [/салон|barber|барбер|beauty|красот|nail|маникюр|косметик|gold apple|золотое яблоко|letu|летуаль/iu, 'beauty'],
  [/fitness|фитнес|gym|спорт|sport|бассейн|world class|invictus/iu, 'sport'],
  [/университет|university|школ|school|курс|course|udemy|coursera|book|книг|meloman|меломан/iu, 'education'],
  [/аренд|квартплат|коммунал|ерц|алсеко|alseco|astana-?energo|энерго|водоканал|газ\b|kazakhgaz|osi|оси\b/iu, 'housing'],
  [/hotel|отель|booking|airbnb|aviasales|tour|тур\b/iu, 'travel'],
  [/flowers|цвет|подар|gift/iu, 'gifts'],
];

const INCOME_KEYWORDS: [RegExp, string][] = [
  [/зарплат|заработн|salary|оплата труда|аванс/iu, 'salary'],
  [/стипенд|scholarship|шәкіртақы/iu, 'scholarship'],
  [/кэшбэк|кешбэк|cashback|бонус/iu, 'cashback'],
  [/вознагражден|процент|interest|депозит.*доход/iu, 'interest'],
];

/** Looks like a transfer between the user's own Kaspi products. */
export function isOwnTransfer(details: string): boolean {
  return /kaspi\s*(депозит|deposit|gold|red|копилк)|свой счет|свой счёт|между своими|с депозита|на депозит/i.test(details);
}

export interface Guess {
  categoryKey?: string; // built-in key, e.g. "groceries"
  ruleCategoryId?: string; // from a remembered rule
  ignore?: boolean;
  confident: boolean;
}

export function guessCategory(type: OpType, sign: 1 | -1, details: string, rules: Map<string, MerchantRule>): Guess {
  const rule = rules.get(merchantKey(details));
  if (rule) return { ruleCategoryId: rule.categoryId, ignore: rule.ignore, confident: true };
  if (sign > 0) {
    const hit = INCOME_KEYWORDS.find(([re]) => re.test(details));
    return { categoryKey: hit?.[1] ?? 'other_in', confident: !!hit };
  }
  const hit = KEYWORDS.find(([re]) => re.test(details));
  if (hit) return { categoryKey: hit[1], confident: true };
  return { categoryKey: 'other', confident: false };
}
