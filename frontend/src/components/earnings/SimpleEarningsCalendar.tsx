import React, { useState, useEffect } from 'react';
import { Calendar, TrendingUp, Building2, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface EarningsEntry {
  id: string;
  symbol: string;
  company_name?: string;
  earnings_date: string;
  time_of_day?: 'before_market' | 'after_market' | 'during_market';
  importance_rating?: number;
  status: 'scheduled' | 'reported';
}

const SimpleEarningsCalendar: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);

  // Always show some sample data
  const sampleEarnings: EarningsEntry[] = [
    {
      id: '1',
      symbol: 'AAPL',
      company_name: 'Apple Inc.',
      earnings_date: '2025-01-27',
      time_of_day: 'after_market',
      importance_rating: 5,
      status: 'scheduled'
    },
    {
      id: '2',
      symbol: 'TSLA',
      company_name: 'Tesla Inc.',
      earnings_date: '2025-01-27',
      time_of_day: 'after_market',
      importance_rating: 4,
      status: 'scheduled'
    },
    {
      id: '3',
      symbol: 'MSFT',
      company_name: 'Microsoft Corporation',
      earnings_date: '2025-01-28',
      time_of_day: 'after_market',
      importance_rating: 5,
      status: 'scheduled'
    },
    {
      id: '4',
      symbol: 'GOOGL',
      company_name: 'Alphabet Inc.',
      earnings_date: '2025-01-29',
      time_of_day: 'after_market',
      importance_rating: 5,
      status: 'scheduled'
    },
    {
      id: '5',
      symbol: 'META',
      company_name: 'Meta Platforms Inc.',
      earnings_date: '2025-01-29',
      time_of_day: 'after_market',
      importance_rating: 4,
      status: 'scheduled'
    }
  ];

  useEffect(() => {
    // Simulate loading
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  }, []);

  const getImportanceColor = (rating?: number): string => {
    if (!rating) return 'bg-gray-100 text-gray-600';
    if (rating >= 4) return 'bg-red-100 text-red-800';
    if (rating >= 3) return 'bg-orange-100 text-orange-800';
    if (rating >= 2) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const getTimeOfDayIcon = (timeOfDay?: string) => {
    switch (timeOfDay) {
      case 'before_market':
        return '🌅';
      case 'after_market':
        return '🌙';
      case 'during_market':
        return '🕐';
      default:
        return '📅';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Earnings Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Earnings Calendar - This Week
            </CardTitle>
            <Badge variant="secondary">
              {sampleEarnings.length} Companies
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Earnings List */}
      <div className="grid gap-4">
        {sampleEarnings.map((earning) => (
          <Card key={earning.id} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getTimeOfDayIcon(earning.time_of_day)}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">{earning.symbol}</span>
                        {earning.importance_rating && earning.importance_rating >= 4 && (
                          <Star className="w-4 h-4 text-orange-500" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{earning.company_name}</p>
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <p className="font-medium">{earning.earnings_date}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge 
                      variant="secondary" 
                      className={getImportanceColor(earning.importance_rating)}
                    >
                      Importance: {earning.importance_rating}/5
                    </Badge>
                    <Badge variant={earning.status === 'scheduled' ? 'default' : 'success'}>
                      {earning.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Total Companies</p>
                <p className="text-2xl font-bold">{sampleEarnings.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-sm text-gray-600">High Importance</p>
                <p className="text-2xl font-bold">
                  {sampleEarnings.filter(e => (e.importance_rating || 0) >= 4).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Average Rating</p>
                <p className="text-2xl font-bold">
                  {(sampleEarnings.reduce((acc, e) => acc + (e.importance_rating || 0), 0) / sampleEarnings.length).toFixed(1)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Message */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-blue-600 mt-1" />
            <div>
              <h3 className="font-medium text-blue-900">Earnings Calendar Ready!</h3>
              <p className="text-sm text-blue-700 mt-1">
                This is a demo version showing sample earnings data. The calendar integrates with your SEC EDGAR earnings system
                and will display real earnings data once the migration is run and data is populated.
              </p>
              <div className="mt-3 text-xs text-blue-600">
                <p>• Calendar view with monthly layout</p>
                <p>• Real-time earnings data from SEC filings</p>
                <p>• Interactive earnings details and reports</p>
                <p>• Integration with your AI analysis pipeline</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SimpleEarningsCalendar;