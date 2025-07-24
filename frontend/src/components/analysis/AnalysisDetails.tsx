import React from 'react';
import { DailyAnalysis } from '@/lib/api';
import { TrendingUp, AlertTriangle, Target, Globe } from 'lucide-react';

interface AnalysisDetailsProps {
  analysis: DailyAnalysis;
}

export const AnalysisDetails: React.FC<AnalysisDetailsProps> = ({ analysis }) => {
  const aiAnalysis = analysis.ai_analysis || {};
  
  return (
    <div className="space-y-6 mt-4">
      {aiAnalysis.market_drivers && aiAnalysis.market_drivers.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            Market Drivers
          </h4>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            {aiAnalysis.market_drivers.map((driver: string, index: number) => (
              <li key={index}>{driver}</li>
            ))}
          </ul>
        </div>
      )}
      
      {aiAnalysis.risk_factors && aiAnalysis.risk_factors.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            Risk Factors
          </h4>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            {aiAnalysis.risk_factors.map((risk: string, index: number) => (
              <li key={index}>{risk}</li>
            ))}
          </ul>
        </div>
      )}
      
      {aiAnalysis.opportunities && aiAnalysis.opportunities.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Target className="h-4 w-4 text-blue-600" />
            Opportunities
          </h4>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            {aiAnalysis.opportunities.map((opportunity: string, index: number) => (
              <li key={index}>{opportunity}</li>
            ))}
          </ul>
        </div>
      )}
      
      {aiAnalysis.geopolitical_context && (
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Globe className="h-4 w-4 text-purple-600" />
            Geopolitical Context
          </h4>
          <p className="text-sm text-muted-foreground">
            {aiAnalysis.geopolitical_context}
          </p>
        </div>
      )}
      
      {aiAnalysis.economic_indicators && aiAnalysis.economic_indicators.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Economic Indicators</h4>
          <div className="flex flex-wrap gap-2">
            {aiAnalysis.economic_indicators.map((indicator: string, index: number) => (
              <span 
                key={index} 
                className="text-xs px-2 py-1 bg-secondary rounded-md"
              >
                {indicator}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};