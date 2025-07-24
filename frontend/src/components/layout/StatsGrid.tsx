import React from 'react';
import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModernCard, CardContent } from '@/components/ui/ModernCard';
import { ModernBadge } from '@/components/ui/ModernBadge';

interface StatItem {
  id: string;
  label: string;
  value: string | number;
  subValue?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    label?: string;
    direction: 'up' | 'down' | 'neutral';
  };
  status?: 'default' | 'success' | 'warning' | 'error' | 'info';
  clickable?: boolean;
  onClick?: () => void;
}

interface StatsGridProps {
  stats: StatItem[];
  columns?: 1 | 2 | 3 | 4 | 5 | 6;
  loading?: boolean;
  className?: string;
}

export const StatsGrid: React.FC<StatsGridProps> = ({
  stats,
  columns = 4,
  loading = false,
  className
}) => {
  const gridColumns = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
    6: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'
  };

  const statusColors = {
    default: 'text-foreground',
    success: 'text-green-600 dark:text-green-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    error: 'text-red-600 dark:text-red-400',
    info: 'text-blue-600 dark:text-blue-400'
  };

  const getTrendIcon = (direction: 'up' | 'down' | 'neutral') => {
    switch (direction) {
      case 'up':
        return <TrendingUp className="h-3 w-3 text-green-600" />;
      case 'down':
        return <TrendingDown className="h-3 w-3 text-red-600" />;
      default:
        return <Minus className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getTrendColor = (direction: 'up' | 'down' | 'neutral') => {
    switch (direction) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <div className={cn(`grid gap-4 ${gridColumns[columns]}`, className)}>
        {Array.from({ length: columns * 2 }).map((_, index) => (
          <ModernCard key={index} variant="glass">
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/3"></div>
              </div>
            </CardContent>
          </ModernCard>
        ))}
      </div>
    );
  }

  return (
    <div className={cn(`grid gap-4 ${gridColumns[columns]}`, className)}>
      {stats.map((stat) => (
        <ModernCard
          key={stat.id}
          variant="glass"
          className={cn(
            "transition-all duration-200 hover:shadow-md",
            stat.clickable && "cursor-pointer hover:shadow-lg"
          )}
          onClick={stat.onClick}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </p>
                  {stat.icon && (
                    <div className="text-muted-foreground">
                      {stat.icon}
                    </div>
                  )}
                </div>
                
                <div className="space-y-1">
                  <p className={cn(
                    "text-2xl font-bold",
                    statusColors[stat.status || 'default']
                  )}>
                    {stat.value}
                  </p>
                  
                  {stat.subValue && (
                    <p className="text-xs text-muted-foreground">
                      {stat.subValue}
                    </p>
                  )}
                </div>
                
                {stat.trend && (
                  <div className="flex items-center gap-1">
                    {getTrendIcon(stat.trend.direction)}
                    <span className={cn(
                      "text-xs font-medium",
                      getTrendColor(stat.trend.direction)
                    )}>
                      {stat.trend.value > 0 && '+'}
                      {stat.trend.value}%
                      {stat.trend.label && (
                        <span className="text-muted-foreground ml-1">
                          {stat.trend.label}
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </ModernCard>
      ))}
    </div>
  );
};

// Utility function to create stat items
export const createStatItem = (
  id: string,
  label: string,
  value: string | number,
  options?: Partial<Omit<StatItem, 'id' | 'label' | 'value'>>
): StatItem => ({
  id,
  label,
  value,
  ...options
});

// Common stat item creators
export const createStatItems = {
  count: (id: string, label: string, count: number | undefined | null, options?: Partial<StatItem>) =>
    createStatItem(id, label, (count ?? 0).toLocaleString(), options),
  
  percentage: (id: string, label: string, percentage: number | undefined | null, options?: Partial<StatItem>) =>
    createStatItem(id, label, `${(percentage ?? 0).toFixed(1)}%`, options),
  
  currency: (id: string, label: string, amount: number | undefined | null, options?: Partial<StatItem>) =>
    createStatItem(id, label, new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD' 
    }).format(amount ?? 0), options),
  
  duration: (id: string, label: string, seconds: number | undefined | null, options?: Partial<StatItem>) => {
    const safeSeconds = seconds ?? 0;
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const remainingSeconds = safeSeconds % 60;
    
    let value = '';
    if (hours > 0) value += `${hours}h `;
    if (minutes > 0) value += `${minutes}m `;
    if (remainingSeconds > 0 || value === '') value += `${remainingSeconds}s`;
    
    return createStatItem(id, label, value.trim(), options);
  },
  
  withTrend: (
    id: string, 
    label: string, 
    value: string | number, 
    trendValue: number | undefined | null,
    trendLabel?: string,
    options?: Partial<StatItem>
  ) => {
    const safeTrendValue = trendValue ?? 0;
    return createStatItem(id, label, value, {
      ...options,
      trend: {
        value: safeTrendValue,
        label: trendLabel,
        direction: safeTrendValue > 0 ? 'up' : safeTrendValue < 0 ? 'down' : 'neutral'
      }
    });
  }
};