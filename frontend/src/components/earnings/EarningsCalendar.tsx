import React, { useState, useEffect } from 'react';
import { Calendar, TrendingUp, Building2, Clock, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { EarningsCalendarSkeleton } from './EarningsCalendarSkeleton';

interface EarningsEntry {
  id: string;
  symbol: string;
  company_name?: string;
  earnings_date: string;
  time_of_day?: 'before_market' | 'after_market' | 'during_market';
  fiscal_quarter?: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  fiscal_year?: number;
  importance_rating?: number;
  status: 'scheduled' | 'reported' | 'delayed' | 'cancelled';
  confirmed: boolean;
  has_reports: boolean;
  has_transcripts: boolean;
  days_until: number;
  reporting_status: 'reported' | 'missed' | 'scheduled';
}

interface CalendarDay {
  date: string;
  earnings: EarningsEntry[];
  total_companies: number;
  high_importance_count: number;
}

const EarningsCalendar: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarData, setCalendarData] = useState<Record<string, EarningsEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');

  useEffect(() => {
    fetchEarningsData();
  }, [selectedDate, view]);

  const fetchEarningsData = async () => {
    try {
      setLoading(true);
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth() + 1;
      
      console.log('Fetching earnings data for:', year, month);
      
      // Use mock API for now - replace with real API call later
      const { earningsApi } = await import('@/services/earningsApi');
      const result = await earningsApi.getEarningsCalendarMonth(year, month);
      
      console.log('Earnings API result:', result);
      
      if (result.success) {
        setCalendarData(result.data.calendar);
        console.log('Calendar data set:', result.data.calendar);
      }
    } catch (error) {
      console.error('Error fetching earnings data:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const renderCalendarGrid = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days = [];
    const current = new Date(startDate);

    console.log('Rendering calendar for:', year, month, 'Calendar data:', calendarData);

    while (current <= lastDay || current.getDay() !== 0) {
      const dateStr = current.toISOString().split('T')[0];
      const dayEarnings = calendarData[dateStr] || [];
      const isCurrentMonth = current.getMonth() === month;
      const isToday = current.toDateString() === new Date().toDateString();
      
      if (dayEarnings.length > 0) {
        console.log('Found earnings for', dateStr, ':', dayEarnings);
      }

      days.push(
        <div
          key={dateStr}
          className={`min-h-[120px] border border-gray-200 p-2 ${
            isCurrentMonth ? 'bg-white' : 'bg-gray-50'
          } ${isToday ? 'ring-2 ring-blue-500' : ''} animate-in scale-in`}
          style={{ animationDelay: `${200 + days.length * 10}ms` }}
        >
          <div className="flex justify-between items-center mb-2">
            <span className={`text-sm font-medium ${
              isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
            }`}>
              {current.getDate()}
            </span>
            {dayEarnings.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {dayEarnings.length}
              </Badge>
            )}
          </div>
          
          <div className="space-y-1">
            {dayEarnings.slice(0, 3).map((earning) => (
              <div
                key={earning.id}
                className={`text-xs p-1 rounded truncate cursor-pointer hover:bg-opacity-80 hover-scale transition-all ${
                  getImportanceColor(earning.importance_rating)
                }`}
                title={`${earning.symbol} - ${earning.company_name}`}
                onClick={() => handleEarningClick(earning)}
              >
                <div className="flex items-center gap-1">
                  <span>{getTimeOfDayIcon(earning.time_of_day)}</span>
                  <span className="font-medium">{earning.symbol}</span>
                  {earning.importance_rating && earning.importance_rating >= 4 && (
                    <Star className="w-3 h-3" />
                  )}
                </div>
              </div>
            ))}
            {dayEarnings.length > 3 && (
              <div className="text-xs text-gray-500 text-center">
                +{dayEarnings.length - 3} more
              </div>
            )}
          </div>
        </div>
      );

      current.setDate(current.getDate() + 1);
    }

    return days;
  };

  const handleEarningClick = (earning: EarningsEntry) => {
    // Open earnings detail modal or navigate to detail page
    console.log('Clicked earning:', earning);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    setSelectedDate(newDate);
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  if (loading) {
    return <EarningsCalendarSkeleton />;
  }

  return (
    <div className="space-y-6 animate-in slide-in-up">
      {/* Header */}
      <Card className="animate-in scale-in">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Earnings Calendar
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth('prev')}
              >
                ←
              </Button>
              <span className="font-medium text-lg min-w-[140px] text-center">
                {monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth('next')}
              >
                →
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Legend */}
      <Card className="animate-in scale-in" style={{ animationDelay: '50ms' }}>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 text-sm stagger-in">
            <div className="flex items-center gap-2 animate-in slide-in-right" style={{ animationDelay: '100ms' }}>
              <span>🌅</span>
              <span>Before Market</span>
            </div>
            <div className="flex items-center gap-2 animate-in slide-in-right" style={{ animationDelay: '120ms' }}>
              <span>🌙</span>
              <span>After Market</span>
            </div>
            <div className="flex items-center gap-2 animate-in slide-in-right" style={{ animationDelay: '140ms' }}>
              <span>🕐</span>
              <span>During Market</span>
            </div>
            <div className="flex items-center gap-2 animate-in slide-in-right" style={{ animationDelay: '160ms' }}>
              <Star className="w-4 h-4" />
              <span>High Importance</span>
            </div>
            <div className="flex items-center gap-2 animate-in slide-in-right" style={{ animationDelay: '180ms' }}>
              <div className="w-3 h-3 bg-red-100 rounded"></div>
              <span>Critical (4-5)</span>
            </div>
            <div className="flex items-center gap-2 animate-in slide-in-right" style={{ animationDelay: '200ms' }}>
              <div className="w-3 h-3 bg-orange-100 rounded"></div>
              <span>High (3)</span>
            </div>
            <div className="flex items-center gap-2 animate-in slide-in-right" style={{ animationDelay: '220ms' }}>
              <div className="w-3 h-3 bg-yellow-100 rounded"></div>
              <span>Medium (2)</span>
            </div>
            <div className="flex items-center gap-2 animate-in slide-in-right" style={{ animationDelay: '240ms' }}>
              <div className="w-3 h-3 bg-green-100 rounded"></div>
              <span>Low (1)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar Grid */}
      <Card className="animate-in scale-in" style={{ animationDelay: '100ms' }}>
        <CardContent className="p-0">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="p-3 text-center font-medium text-gray-600 border-r border-gray-200 last:border-r-0">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar days */}
          <div className="grid grid-cols-7">
            {renderCalendarGrid()}
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="animate-in slide-in-up hover-lift" style={{ animationDelay: '550ms' }}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Total Companies</p>
                <p className="text-2xl font-bold">
                  {Object.values(calendarData).flat().length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-in slide-in-up hover-lift" style={{ animationDelay: '600ms' }}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-sm text-gray-600">High Importance</p>
                <p className="text-2xl font-bold">
                  {Object.values(calendarData).flat().filter(e => (e.importance_rating || 0) >= 4).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-in slide-in-up hover-lift" style={{ animationDelay: '650ms' }}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">This Week</p>
                <p className="text-2xl font-bold">
                  {Object.entries(calendarData)
                    .filter(([date]) => {
                      const d = new Date(date);
                      const now = new Date();
                      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                      return d >= now && d <= weekFromNow;
                    })
                    .reduce((total, [, earnings]) => total + earnings.length, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EarningsCalendar;