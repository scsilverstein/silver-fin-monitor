import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export const UTCClock: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatUTCTime = (date: Date) => {
    return date.toUTCString().split(' ').slice(4, 5)[0]; // Gets just the time part (HH:MM:SS)
  };

  const formatUTCDate = (date: Date) => {
    return date.toUTCString().split(' ').slice(1, 4).join(' '); // Gets the date part
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg border">
      <Clock className="h-4 w-4 text-muted-foreground" />
      <div className="text-sm">
        <div className="font-mono font-medium text-foreground">
          {formatUTCTime(time)}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatUTCDate(time)} UTC
        </div>
      </div>
    </div>
  );
};