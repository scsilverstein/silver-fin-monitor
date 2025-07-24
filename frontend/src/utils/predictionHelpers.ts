import { format } from 'date-fns';
import { Prediction } from '@/lib/api';

export const getHorizonBadgeColor = (horizon: string) => {
  switch (horizon) {
    case '1_week': return 'bg-blue-100 text-blue-700';
    case '1_month': return 'bg-green-100 text-green-700';
    case '3_months': return 'bg-yellow-100 text-yellow-700';
    case '6_months': return 'bg-orange-100 text-orange-700';
    case '1_year': return 'bg-purple-100 text-purple-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

export const formatHorizon = (horizon: string) => {
  return horizon.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
};

export const formatType = (type: string) => {
  return type.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

export const exportPredictions = (predictions: Prediction[]) => {
  try {
    const dataToExport = {
      exportedAt: new Date().toISOString(),
      totalPredictions: predictions.length,
      predictions: predictions.map(p => ({
        id: p.id,
        type: p.predictionType,
        text: p.predictionText,
        confidence: p.confidenceLevel,
        timeHorizon: p.timeHorizon,
        data: p.predictionData,
        createdAt: p.createdAt
      }))
    };

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `predictions-${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Failed to export predictions:', err);
  }
};