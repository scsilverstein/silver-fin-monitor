// Stock scanner results component following CLAUDE.md specification
import React, { useEffect, useState } from 'react';
import { useStockStore } from '../../store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Progress } from '../ui/progress';
import { 
  AlertCircle, 
  TrendingUp, 
  TrendingDown,
  Star,
  StarOff,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Filter,
  BarChart3,
  Eye
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface StockScannerResultsProps {
  onSymbolSelect?: (symbol: string) => void;
}

export const StockScannerResults: React.FC<StockScannerResultsProps> = ({ 
  onSymbolSelect 
}) => {
  const { 
    scannerResults, 
    watchlist,
    loading, 
    error, 
    filters,
    fetchScannerResults,
    fetchWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    setFilters,
    runScanner
  } = useStockStore();

  const [sortBy, setSortBy] = useState<'score' | 'change' | 'name'>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchScannerResults();
    fetchWatchlist();
  }, [fetchScannerResults, fetchWatchlist, filters]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  const handleWatchlistToggle = async (symbol: string) => {
    const isInWatchlist = watchlist.some(s => s.symbol === symbol);
    try {
      if (isInWatchlist) {
        await removeFromWatchlist(symbol);
      } else {
        await addToWatchlist(symbol);
      }
    } catch (error) {
      console.error('Failed to update watchlist:', error);
    }
  };

  const getScanTypeIcon = (type: string) => {
    switch (type) {
      case 'momentum':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'value':
        return <BarChart3 className="h-4 w-4 text-blue-500" />;
      case 'earnings_revision':
        return <ArrowUp className="h-4 w-4 text-purple-500" />;
      default:
        return null;
    }
  };

  const sortedResults = [...scannerResults].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'score':
        comparison = a.composite_score - b.composite_score;
        break;
      case 'change':
        comparison = (a.changes?.earnings_1d || 0) - (b.changes?.earnings_1d || 0);
        break;
      case 'name':
        comparison = a.symbol.localeCompare(b.symbol);
        break;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  if (loading && scannerResults.length === 0) {
    return <ScannerResultsSkeleton />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <Select
              value={filters.scan_type || 'all'}
              onValueChange={(value) => handleFilterChange('scan_type', value)}
            >
              <SelectTrigger className="sm:w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Scan Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Scans</SelectItem>
                <SelectItem value="momentum">Momentum</SelectItem>
                <SelectItem value="value">Value</SelectItem>
                <SelectItem value="earnings_revision">Earnings Revision</SelectItem>
              </SelectContent>
            </Select>
            
            <Select
              value={sortBy}
              onValueChange={(value: any) => setSortBy(value)}
            >
              <SelectTrigger className="sm:w-[150px]">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score">Score</SelectItem>
                <SelectItem value="change">Change %</SelectItem>
                <SelectItem value="name">Symbol</SelectItem>
              </SelectContent>
            </Select>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
            </Button>
            
            <div className="flex-1" />
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => runScanner()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Run Scanner
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sortedResults.map((result) => {
          const isWatchlisted = watchlist.some(s => s.symbol === result.symbol);
          const changeColor = (result.changes?.earnings_1d || 0) >= 0 ? 'text-green-500' : 'text-red-500';
          
          return (
            <Card 
              key={result.symbol} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onSymbolSelect?.(result.symbol)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {result.symbol}
                      {getScanTypeIcon(result.scan_type)}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {result.company_name}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleWatchlistToggle(result.symbol);
                    }}
                  >
                    {isWatchlisted ? (
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ) : (
                      <StarOff className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-3">
                {/* Score */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-muted-foreground">Composite Score</span>
                    <span className="text-sm font-medium">
                      {result.composite_score.toFixed(0)}/100
                    </span>
                  </div>
                  <Progress value={result.composite_score} className="h-2" />
                </div>
                
                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">1D Change</p>
                    <p className={`font-medium ${changeColor}`}>
                      {result.changes?.earnings_1d > 0 && '+'}
                      {(result.changes?.earnings_1d || 0).toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">5D Change</p>
                    <p className={`font-medium ${(result.changes?.earnings_5d || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {result.changes?.earnings_5d > 0 && '+'}
                      {(result.changes?.earnings_5d || 0).toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">P/E Ratio</p>
                    <p className="font-medium">{result.metrics?.pe_ratio?.toFixed(2) || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Forward P/E</p>
                    <p className="font-medium">{result.metrics?.forward_pe?.toFixed(2) || 'N/A'}</p>
                  </div>
                </div>
                
                {/* Alerts */}
                {result.alerts && result.alerts.length > 0 && (
                  <div className="space-y-1">
                    {result.alerts.slice(0, 2).map((alert, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {alert}
                      </Badge>
                    ))}
                  </div>
                )}
                
                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSymbolSelect?.(result.symbol);
                    }}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Details
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Open peer comparison
                    }}
                  >
                    <BarChart3 className="h-3 w-3 mr-1" />
                    Peers
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {sortedResults.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No scanner results found</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => runScanner()}
            >
              Run Scanner Now
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Loading skeleton
const ScannerResultsSkeleton: React.FC = () => (
  <div className="space-y-4">
    <Card>
      <CardContent className="pt-6">
        <div className="flex gap-4">
          <Skeleton className="h-10 w-[200px]" />
          <Skeleton className="h-10 w-[150px]" />
          <Skeleton className="h-10 w-10" />
        </div>
      </CardContent>
    </Card>
    
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-20 mb-2" />
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
);