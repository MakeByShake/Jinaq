import {
  ShoppingCart, Coffee, Bus, CarTaxiFront, Home, Wifi, Repeat, HeartPulse, Shirt, Sparkles,
  Gamepad2, GraduationCap, Gift, Plane, Dumbbell, Sofa, PawPrint, MoreHorizontal, Briefcase,
  BookOpen, Laptop, Store, Percent, Landmark, Wallet, CreditCard, PiggyBank, Banknote, Smartphone,
  Car, Fuel, Baby, Music, Film, Utensils, Pizza, Beer, Pill, Scissors, Wrench, Zap, Droplet,
  Flame, Train, Bike, Ticket, Camera, Headphones, Watch, Gem, Trophy, Target, Star, Heart,
  Globe, Sun, Umbrella, Package, HandCoins, Coins, Receipt, TrendingUp, Building2, Shield,
  Palette, Tv, Cigarette, Church, Users, type LucideIcon,
} from 'lucide-react';

/** Curated icon set used for categories, accounts and goals. Stored by key in Firestore. */
export const ICONS: Record<string, LucideIcon> = {
  cart: ShoppingCart, coffee: Coffee, bus: Bus, taxi: CarTaxiFront, home: Home, wifi: Wifi,
  repeat: Repeat, health: HeartPulse, shirt: Shirt, beauty: Sparkles, game: Gamepad2,
  education: GraduationCap, gift: Gift, plane: Plane, sport: Dumbbell, sofa: Sofa, pet: PawPrint,
  more: MoreHorizontal, briefcase: Briefcase, book: BookOpen, laptop: Laptop, store: Store,
  percent: Percent, bank: Landmark, wallet: Wallet, card: CreditCard, piggy: PiggyBank,
  cash: Banknote, phone: Smartphone, car: Car, fuel: Fuel, baby: Baby, music: Music, film: Film,
  food: Utensils, pizza: Pizza, beer: Beer, pill: Pill, scissors: Scissors, wrench: Wrench,
  zap: Zap, droplet: Droplet, flame: Flame, train: Train, bike: Bike, ticket: Ticket,
  camera: Camera, headphones: Headphones, watch: Watch, gem: Gem, trophy: Trophy, target: Target,
  star: Star, heart: Heart, globe: Globe, sun: Sun, umbrella: Umbrella, package: Package,
  handCoins: HandCoins, coins: Coins, receipt: Receipt, trending: TrendingUp, building: Building2,
  shield: Shield, palette: Palette, tv: Tv, smoke: Cigarette, charity: Church, users: Users,
};

export const ICON_KEYS = Object.keys(ICONS);

export function getIcon(key?: string): LucideIcon {
  return (key && ICONS[key]) || MoreHorizontal;
}

/** Category palette — muted enough for both themes, distinct enough for charts. */
export const PALETTE = [
  '#10B981', // emerald
  '#F59E0B', // amber
  '#3B82F6', // blue
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
  '#6366F1', // indigo
  '#84CC16', // lime
  '#06B6D4', // cyan
  '#A855F7', // purple
  '#64748B', // slate
  '#D946EF', // fuchsia
];

interface IconBubbleProps {
  icon?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: { box: 'h-8 w-8 rounded-xl', icon: 'h-4 w-4' },
  md: { box: 'h-10 w-10 rounded-2xl', icon: 'h-[18px] w-[18px]' },
  lg: { box: 'h-12 w-12 rounded-2xl', icon: 'h-5 w-5' },
};

/** Tinted rounded square with a coloured glyph — the visual unit for categories. */
export function IconBubble({ icon, color = '#64748B', size = 'md', className = '' }: IconBubbleProps) {
  const Icon = getIcon(icon);
  const s = SIZES[size];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${s.box} ${className}`}
      style={{ backgroundColor: `${color}1F`, color }}
      aria-hidden
    >
      <Icon className={s.icon} strokeWidth={2.2} />
    </span>
  );
}
