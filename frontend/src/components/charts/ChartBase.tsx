import React from 'react';
import { ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Download, Maximize2, RefreshCw } from 'lucide-react';

interface ChartBaseProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  height?: number;
  badges?: Array<{
    text: string;
    variant?: 'default' | 'secondary' | 'outline' | 'destructive';
  }>;
  actions?: React.ReactNode;
  onRefresh?: () => void;
  onDownload?: () => void;
  onExpand?: () => void;
  className?: string;
}

export const ChartBase: React.FC<ChartBaseProps> = ({
  title,
  subtitle,
  children,
  loading = false,
  error = null,
  height = 350,
  badges = [],
  actions,
  onRefresh,
  onDownload,
  onExpand,
  className = ''
}) => {
  if (loading) {
    return (
      <Card className={`relative overflow-hidden ${className}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">{title}</CardTitle>
              {subtitle && (
                <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
              )}
            </div>
            <div className="flex gap-2">
              {badges.map((badge, index) => (
                <Badge key={index} variant={badge.variant || 'default'}>
                  {badge.text}
                </Badge>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div 
            className="animate-pulse bg-gradient-to-r from-muted via-muted/50 to-muted rounded-lg"
            style={{ height: `${height}px` }}
          >
            <div className="h-full flex items-center justify-center">
              <div className="flex items-center space-x-2 text-muted-foreground">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span className="text-sm">Loading chart data...</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`border-destructive/20 ${className}`}>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-destructive">{title}</CardTitle>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </CardHeader>
        <CardContent>
          <div 
            className="flex items-center justify-center bg-destructive/5 rounded-lg border border-destructive/20"
            style={{ height: `${height}px` }}
          >
            <div className="text-center">
              <p className="text-sm text-destructive font-medium">Failed to load chart</p>
              <p className="text-xs text-destructive/80 mt-1">{error}</p>
              {onRefresh && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRefresh}
                  className="mt-3"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`relative group ${className}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg font-semibold">{title}</CardTitle>
              {badges.map((badge, index) => (
                <Badge key={index} variant={badge.variant || 'default'}>
                  {badge.text}
                </Badge>
              ))}
            </div>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {actions}
            {(onRefresh || onDownload || onExpand) && (
              <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                {onRefresh && (
                  <Button variant="ghost" size="sm" onClick={onRefresh}>
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                )}
                {onDownload && (
                  <Button variant="ghost" size="sm" onClick={onDownload}>
                    <Download className="w-4 h-4" />
                  </Button>
                )}
                {onExpand && (
                  <Button variant="ghost" size="sm" onClick={onExpand}>
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div style={{ height: `${height}px` }}>
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};