import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export const getSentimentDisplay = (score: number) => {
  if (score > 0.2) {
    return {
      color: 'text-green-600',
      bg: 'bg-green-50 dark:bg-green-950/30',
      icon: <TrendingUp className="w-4 h-4" />,
      label: 'Positive'
    };
  } else if (score < -0.2) {
    return {
      color: 'text-red-600',
      bg: 'bg-red-50 dark:bg-red-950/30',
      icon: <TrendingDown className="w-4 h-4" />,
      label: 'Negative'
    };
  } else {
    return {
      color: 'text-gray-600',
      bg: 'bg-gray-50 dark:bg-gray-950/30',
      icon: <Minus className="w-4 h-4" />,
      label: 'Neutral'
    };
  }
};

export const formatPreview = (text: string, maxLength: number = 150) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};