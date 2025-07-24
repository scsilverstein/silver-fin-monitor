import React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import EarningsCalendar from '@/components/earnings/EarningsCalendar';

const EarningsCalendarPage: React.FC = () => {
  return (
    <div className="space-y-6 animate-in slide-in-up">
      <div className="animate-in slide-in-down">
        <PageHeader
          title="Earnings Calendar"
          description="Track upcoming earnings announcements, view historical performance, and access earnings reports"
        />
      </div>
      <EarningsCalendar />
    </div>
  );
};

export default EarningsCalendarPage;