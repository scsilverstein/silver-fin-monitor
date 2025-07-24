import React from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { AlertTriangle, Bell } from 'lucide-react';
import { format } from 'date-fns';

interface Alert {
  id: string;
  title: string;
  message: string;
  severity: 'high' | 'medium' | 'low';
  timestamp: string;
}

interface AlertsListProps {
  alerts: Alert[];
  maxItems?: number;
}

const getAlertColor = (severity: string) => {
  switch (severity) {
    case 'high': return 'destructive';
    case 'medium': return 'secondary';
    case 'low': return 'default';
    default: return 'default';
  }
};

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'high': return 'text-red-500';
    case 'medium': return 'text-yellow-500';
    default: return 'text-gray-500';
  }
};

const getBorderColor = (severity: string) => {
  switch (severity) {
    case 'high': return '#ef4444';
    case 'medium': return '#f59e0b';
    default: return '#6b7280';
  }
};

export const AlertsList: React.FC<AlertsListProps> = ({ alerts, maxItems = 3 }) => {
  if (!alerts || alerts.length === 0) return null;

  const displayAlerts = alerts.slice(0, maxItems);

  return (
    <div className="mb-6 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Active Alerts
        </h3>
        <Badge variant="secondary">{alerts.length}</Badge>
      </div>
      <div className="space-y-2">
        {displayAlerts.map(alert => (
          <Card 
            key={alert.id} 
            className="border-l-4" 
            style={{ borderLeftColor: getBorderColor(alert.severity) }}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className={`w-4 h-4 ${getSeverityColor(alert.severity)}`} />
                    <h4 className="font-semibold">{alert.title}</h4>
                    <Badge variant={getAlertColor(alert.severity) as any}>
                      {alert.severity}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{alert.message}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(alert.timestamp), 'HH:mm')}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};