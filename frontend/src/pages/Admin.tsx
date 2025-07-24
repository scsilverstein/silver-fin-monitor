import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Calendar,
  Database,
  BarChart,
  Clock,
  Rss
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface BackfillStatus {
  totalAnalyses: number;
  oldestContent: string;
  newestContent: string;
  totalDaysWithContent: number;
  analyzedDates: string[];
  coverage: string;
}

export const Admin: React.FC = () => {
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillStatus, setBackfillStatus] = useState<BackfillStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchBackfillStatus = async () => {
    try {
      const response = await fetch('/api/v1/admin/backfill-status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch status');

      const data = await response.json();
      setBackfillStatus(data.data);
    } catch (error) {
      console.error('Failed to fetch backfill status:', error);
      setMessage({ type: 'error', text: 'Failed to fetch backfill status' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackfillStatus();
    
    // Refresh status every 10 seconds if backfilling
    const interval = isBackfilling ? setInterval(fetchBackfillStatus, 10000) : null;
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isBackfilling]);

  const startBackfill = async () => {
    setIsBackfilling(true);
    setMessage(null);

    try {
      const response = await fetch('/api/v1/admin/backfill-analysis', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}), // Can add startDate/endDate if needed
      });

      if (!response.ok) throw new Error('Failed to start backfill');

      const data = await response.json();
      setMessage({ type: 'success', text: data.message });
      
      // Start polling for status
      setTimeout(fetchBackfillStatus, 2000);
    } catch (error) {
      console.error('Failed to start backfill:', error);
      setMessage({ type: 'error', text: 'Failed to start backfill process' });
      setIsBackfilling(false);
    }
  };

  const coveragePercentage = parseFloat(backfillStatus?.coverage || '0');
  const missingDays = backfillStatus ? 
    backfillStatus.totalDaysWithContent - backfillStatus.totalAnalyses : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <Button
          onClick={fetchBackfillStatus}
          variant="outline"
          size="sm"
          disabled={loading}
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {message && (
        <Alert className={message.type === 'error' ? 'border-red-500' : 'border-green-500'}>
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* Historical Analysis Backfill Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Historical Analysis Backfill
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : backfillStatus && (
            <>
              {/* Coverage Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Analysis Coverage</span>
                  <span className="text-gray-600">{backfillStatus.coverage}</span>
                </div>
                <Progress value={coveragePercentage} className="h-2" />
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>{backfillStatus.totalAnalyses} days analyzed</span>
                  <span>{missingDays} days missing</span>
                </div>
              </div>

              {/* Date Range Info */}
              <div className="grid grid-cols-2 gap-4 py-4 border-t border-b">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>Oldest Content</span>
                  </div>
                  <p className="font-medium">
                    {backfillStatus.oldestContent ? 
                      format(new Date(backfillStatus.oldestContent), 'MMM dd, yyyy') : 
                      'N/A'}
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>Newest Content</span>
                  </div>
                  <p className="font-medium">
                    {backfillStatus.newestContent ? 
                      format(new Date(backfillStatus.newestContent), 'MMM dd, yyyy') : 
                      'N/A'}
                  </p>
                </div>
              </div>

              {/* Analyzed Dates */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Analyzed Dates</h4>
                <div className="flex flex-wrap gap-1">
                  {backfillStatus.analyzedDates.map(date => (
                    <Badge key={date} variant="secondary" className="text-xs">
                      {format(new Date(date), 'MMM dd')}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  {missingDays > 0 ? (
                    <>
                      <AlertCircle className="w-4 h-4 text-yellow-500" />
                      <span>{missingDays} days need analysis</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>All days analyzed</span>
                    </>
                  )}
                </div>
                <Button
                  onClick={startBackfill}
                  disabled={isBackfilling || missingDays === 0}
                  className="min-w-[140px]"
                >
                  {isBackfilling ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <BarChart className="w-4 h-4 mr-2" />
                      Start Backfill
                    </>
                  )}
                </Button>
              </div>

              {isBackfilling && (
                <Alert className="border-blue-500 bg-blue-50">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    Backfill is running in the background. This may take several minutes.
                    The page will refresh automatically to show progress.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Additional Admin Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">API Status</span>
                <Badge variant="default" className="bg-green-500">Healthy</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Queue Status</span>
                <Badge variant="default" className="bg-green-500">Active</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">AI Service</span>
                <Badge variant="default" className="bg-green-500">Connected</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" size="sm">
              <Rss className="w-4 h-4 mr-2" />
              Process All Feeds
            </Button>
            <Button variant="outline" className="w-full justify-start" size="sm">
              <Database className="w-4 h-4 mr-2" />
              Clear Cache
            </Button>
            <Button variant="outline" className="w-full justify-start" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Restart Workers
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Usage Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">API Calls Today</span>
                <span className="font-medium">1,234</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Feeds Processed</span>
                <span className="font-medium">456</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">AI Tokens Used</span>
                <span className="font-medium">78.9K</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};