import React, { useState, useMemo } from 'react';
import { 
  ModernCard, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  ModernBadge,
  ModernButton,
  ModernInput,
  Select
} from '@/components/ui';
import { PredictionDetail } from './PredictionDetail';
import { 
  Search, 
  Filter, 
  SortAsc, 
  SortDesc,
  Calendar,
  Target,
  TrendingUp,
  BarChart3,
  RefreshCw,
  Download,
  Grid,
  List
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface PredictionData {
  keyAssumptions?: string[];
  measurableOutcomes?: string[];
  generatedFrom?: string;
  [key: string]: any;
}

interface Prediction {
  id: string;
  dailyAnalysisId?: string;
  predictionType?: string;
  predictionText?: string;
  confidenceLevel?: number;
  timeHorizon: '1_week' | '1_month' | '3_months' | '6_months' | '1_year';
  predictionData: PredictionData;
  createdAt: Date;
}

interface PredictionsListProps {
  predictions: Prediction[];
  loading?: boolean;
  onRefresh?: () => void;
  onExport?: () => void;
  className?: string;
}

type SortField = 'createdAt' | 'confidenceLevel' | 'timeHorizon' | 'predictionType';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'grid' | 'list';

export const PredictionsList: React.FC<PredictionsListProps> = ({
  predictions,
  loading = false,
  onRefresh,
  onExport,
  className
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedHorizon, setSelectedHorizon] = useState('all');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  // Get unique values for filters
  const predictionTypes = useMemo(() => {
    const types = new Set(predictions.map(p => p.predictionType).filter(Boolean));
    return Array.from(types);
  }, [predictions]);

  const timeHorizons = useMemo(() => {
    const horizons = new Set(predictions.map(p => p.timeHorizon));
    return Array.from(horizons);
  }, [predictions]);

  // Filter and sort predictions
  const filteredAndSortedPredictions = useMemo(() => {
    let filtered = predictions.filter(prediction => {
      // Search filter
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        const matchesText = prediction.predictionText?.toLowerCase().includes(searchLower);
        const matchesType = prediction.predictionType?.toLowerCase().includes(searchLower);
        const matchesAssumptions = prediction.predictionData.keyAssumptions?.some(
          assumption => assumption.toLowerCase().includes(searchLower)
        );
        const matchesOutcomes = prediction.predictionData.measurableOutcomes?.some(
          outcome => outcome.toLowerCase().includes(searchLower)
        );
        
        if (!matchesText && !matchesType && !matchesAssumptions && !matchesOutcomes) {
          return false;
        }
      }

      // Type filter
      if (selectedType !== 'all' && prediction.predictionType !== selectedType) {
        return false;
      }

      // Time horizon filter
      if (selectedHorizon !== 'all' && prediction.timeHorizon !== selectedHorizon) {
        return false;
      }

      return true;
    });

    // Sort predictions
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case 'confidenceLevel':
          aValue = a.confidenceLevel || 0;
          bValue = b.confidenceLevel || 0;
          break;
        case 'timeHorizon':
          const horizonOrder = { '1_week': 1, '1_month': 2, '3_months': 3, '6_months': 4, '1_year': 5 };
          aValue = horizonOrder[a.timeHorizon];
          bValue = horizonOrder[b.timeHorizon];
          break;
        case 'predictionType':
          aValue = a.predictionType || '';
          bValue = b.predictionType || '';
          break;
        default:
          aValue = 0;
          bValue = 0;
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [predictions, searchQuery, selectedType, selectedHorizon, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getTimeHorizonLabel = (horizon: string) => {
    const labels: Record<string, string> = {
      '1_week': '1 Week',
      '1_month': '1 Month',
      '3_months': '3 Months',
      '6_months': '6 Months',
      '1_year': '1 Year'
    };
    return labels[horizon] || horizon;
  };

  const getPredictionTypeLabel = (type?: string) => {
    const labels: Record<string, string> = {
      'market_direction': 'Market Direction',
      'economic_indicator': 'Economic Indicator',
      'geopolitical_event': 'Geopolitical Event',
      'technology_trend': 'Technology Trend',
      'crypto_market': 'Crypto Market',
      'general': 'General'
    };
    return labels[type || ''] || type || 'Unknown';
  };

  const SortIcon = sortDirection === 'asc' ? SortAsc : SortDesc;

  if (loading) {
    return (
      <ModernCard className={className}>
        <CardHeader>
          <CardTitle>Market Predictions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse p-6 rounded-lg border">
                <div className="h-4 bg-muted rounded w-3/4 mb-3" />
                <div className="h-3 bg-muted rounded w-1/2 mb-3" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </div>
            ))}
          </div>
        </CardContent>
      </ModernCard>
    );
  }

  return (
    <ModernCard className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Market Predictions
              <ModernBadge variant="secondary">
                {filteredAndSortedPredictions.length}
              </ModernBadge>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              AI-generated market forecasts and analysis
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-muted rounded-lg p-1">
              <ModernButton
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="h-8 w-8 p-0"
              >
                <Grid className="h-3 w-3" />
              </ModernButton>
              <ModernButton
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="h-8 w-8 p-0"
              >
                <List className="h-3 w-3" />
              </ModernButton>
            </div>

            {/* Action Buttons */}
            {onRefresh && (
              <ModernButton variant="outline" size="sm" onClick={onRefresh}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh
              </ModernButton>
            )}
            {onExport && (
              <ModernButton variant="outline" size="sm" onClick={onExport}>
                <Download className="h-3 w-3 mr-1" />
                Export
              </ModernButton>
            )}
          </div>
        </div>

        {/* Filters and Search */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <ModernInput
              placeholder="Search predictions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={selectedType} onValueChange={setSelectedType}>
            <option value="all">All Types</option>
            {predictionTypes.map(type => (
              <option key={type} value={type}>
                {getPredictionTypeLabel(type)}
              </option>
            ))}
          </Select>

          <Select value={selectedHorizon} onValueChange={setSelectedHorizon}>
            <option value="all">All Horizons</option>
            {timeHorizons.map(horizon => (
              <option key={horizon} value={horizon}>
                {getTimeHorizonLabel(horizon)}
              </option>
            ))}
          </Select>

          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground mr-2">Sort by:</span>
            <ModernButton
              variant="outline"
              size="sm"
              onClick={() => handleSort('createdAt')}
              className={cn(
                "text-xs",
                sortField === 'createdAt' && "bg-muted"
              )}
            >
              Date
              {sortField === 'createdAt' && <SortIcon className="h-3 w-3 ml-1" />}
            </ModernButton>
            <ModernButton
              variant="outline"
              size="sm"
              onClick={() => handleSort('confidenceLevel')}
              className={cn(
                "text-xs",
                sortField === 'confidenceLevel' && "bg-muted"
              )}
            >
              Confidence
              {sortField === 'confidenceLevel' && <SortIcon className="h-3 w-3 ml-1" />}
            </ModernButton>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {filteredAndSortedPredictions.length === 0 ? (
          <div className="text-center py-12">
            <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No predictions found</h3>
            <p className="text-muted-foreground">
              {searchQuery || selectedType !== 'all' || selectedHorizon !== 'all'
                ? 'Try adjusting your filters to see more predictions.'
                : 'No predictions have been generated yet.'}
            </p>
          </div>
        ) : (
          <div className={cn(
            "space-y-6",
            viewMode === 'grid' && "grid grid-cols-1 xl:grid-cols-2 gap-6 space-y-0"
          )}>
            {filteredAndSortedPredictions.map((prediction) => (
              <PredictionDetail
                key={prediction.id}
                prediction={prediction}
                showRawJson={false}
                className={cn(
                  "transition-all duration-200",
                  viewMode === 'list' && "hover:shadow-md",
                  expandedCard === prediction.id && "ring-2 ring-primary"
                )}
              />
            ))}
          </div>
        )}
      </CardContent>
    </ModernCard>
  );
};