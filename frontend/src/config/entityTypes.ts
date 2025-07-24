import {
  Building2,
  Users,
  Globe,
  Landmark,
  Banknote,
  LineChart,
  Coins,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';

export const sentimentColors = {
  positive: 'text-green-500',
  negative: 'text-red-500',
  neutral: 'text-gray-500'
};

export const sentimentIcons = {
  positive: '📈',
  negative: '📉',
  neutral: '➖'
};

export const entityTypeConfig = {
  companies: {
    icon: Building2,
    label: 'Companies',
    color: 'blue',
    bgClass: 'bg-blue-50 dark:bg-blue-950/30',
    borderClass: 'border-blue-200 dark:border-blue-800',
    textClass: 'text-blue-700 dark:text-blue-300',
    iconClass: 'text-blue-600 dark:text-blue-400',
    badgeVariant: 'default' as const
  },
  people: {
    icon: Users,
    label: 'People',
    color: 'purple',
    bgClass: 'bg-purple-50 dark:bg-purple-950/30',
    borderClass: 'border-purple-200 dark:border-purple-800',
    textClass: 'text-purple-700 dark:text-purple-300',
    iconClass: 'text-purple-600 dark:text-purple-400',
    badgeVariant: 'secondary' as const
  },
  locations: {
    icon: Globe,
    label: 'Locations',
    color: 'emerald',
    bgClass: 'bg-emerald-50 dark:bg-emerald-950/30',
    borderClass: 'border-emerald-200 dark:border-emerald-800',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    iconClass: 'text-emerald-600 dark:text-emerald-400',
    badgeVariant: 'outline' as const
  },
  tickers: {
    icon: LineChart,
    label: 'Tickers',
    color: 'indigo',
    bgClass: 'bg-indigo-50 dark:bg-indigo-950/30',
    borderClass: 'border-indigo-200 dark:border-indigo-800',
    textClass: 'text-indigo-700 dark:text-indigo-300',
    iconClass: 'text-indigo-600 dark:text-indigo-400',
    badgeVariant: 'default' as const
  },
  // Legacy mappings for backward compatibility
  company: {
    icon: Building2,
    label: 'Companies',
    color: 'blue',
    bgClass: 'bg-blue-50 dark:bg-blue-950/30',
    borderClass: 'border-blue-200 dark:border-blue-800',
    textClass: 'text-blue-700 dark:text-blue-300',
    iconClass: 'text-blue-600 dark:text-blue-400',
    badgeVariant: 'default' as const
  },
  person: {
    icon: Users,
    label: 'People',
    color: 'purple',
    bgClass: 'bg-purple-50 dark:bg-purple-950/30',
    borderClass: 'border-purple-200 dark:border-purple-800',
    textClass: 'text-purple-700 dark:text-purple-300',
    iconClass: 'text-purple-600 dark:text-purple-400',
    badgeVariant: 'secondary' as const
  },
  location: {
    icon: Globe,
    label: 'Locations',
    color: 'emerald',
    bgClass: 'bg-emerald-50 dark:bg-emerald-950/30',
    borderClass: 'border-emerald-200 dark:border-emerald-800',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    iconClass: 'text-emerald-600 dark:text-emerald-400',
    badgeVariant: 'outline' as const
  },
  ticker: {
    icon: LineChart,
    label: 'Tickers',
    color: 'indigo',
    bgClass: 'bg-indigo-50 dark:bg-indigo-950/30',
    borderClass: 'border-indigo-200 dark:border-indigo-800',
    textClass: 'text-indigo-700 dark:text-indigo-300',
    iconClass: 'text-indigo-600 dark:text-indigo-400',
    badgeVariant: 'default' as const
  },
  exchange: {
    icon: Landmark,
    label: 'Exchanges',
    color: 'amber',
    bgClass: 'bg-amber-50 dark:bg-amber-950/30',
    borderClass: 'border-amber-200 dark:border-amber-800',
    textClass: 'text-amber-700 dark:text-amber-300',
    iconClass: 'text-amber-600 dark:text-amber-400',
    badgeVariant: 'secondary' as const
  },
  currency: {
    icon: Banknote,
    label: 'Currencies',
    color: 'green',
    bgClass: 'bg-green-50 dark:bg-green-950/30',
    borderClass: 'border-green-200 dark:border-green-800',
    textClass: 'text-green-700 dark:text-green-300',
    iconClass: 'text-green-600 dark:text-green-400',
    badgeVariant: 'outline' as const
  },
  crypto: {
    icon: Coins,
    label: 'Crypto',
    color: 'orange',
    bgClass: 'bg-orange-50 dark:bg-orange-950/30',
    borderClass: 'border-orange-200 dark:border-orange-800',
    textClass: 'text-orange-700 dark:text-orange-300',
    iconClass: 'text-orange-600 dark:text-orange-400',
    badgeVariant: 'secondary' as const
  },
  commodity: {
    icon: Activity,
    label: 'Commodities',
    color: 'pink',
    bgClass: 'bg-pink-50 dark:bg-pink-950/30',
    borderClass: 'border-pink-200 dark:border-pink-800',
    textClass: 'text-pink-700 dark:text-pink-300',
    iconClass: 'text-pink-600 dark:text-pink-400',
    badgeVariant: 'outline' as const
  }
};