import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  PageContainer, 
  PageHeader, 
  LoadingState, 
  EmptyState 
} from '@/components/layout';
import { ModernCard, CardContent, CardHeader, CardTitle } from '@/components/ui/ModernCard';
import { ModernButton } from '@/components/ui/ModernButton';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  TrendingUp, 
  TrendingDown, 
  Filter, 
  Download, 
  RefreshCw,
  ChevronUp,
  ChevronDown,
  DollarSign,
  Activity,
  Star
} from 'lucide-react';
import { api } from '@/lib/api';
import { format } from 'date-fns';

interface StockData {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  marketCap: number;
  price: number;
  pe: number | null;
  forwardPE: number | null;
  currentRevenue: number;
  guidedRevenue: number | null;
  revenueGrowth: number;
  eps: number;
  forwardEps: number | null;
  priceToBook: number;
  debtToEquity: number;
  expectedGrowth: number;
  valueScore: number;
  isFavorite?: boolean;
}

interface StockFilters {
  sector: string;
  minPE: number | null;
  maxPE: number | null;
  minForwardPE: number | null;
  maxForwardPE: number | null;
  minMarketCap: number | null;
  maxMarketCap: number | null;
  minExpectedGrowth: number | null;
}

type SortField = 'symbol' | 'pe' | 'forwardPE' | 'expectedGrowth' | 'valueScore' | 'marketCap' | 'price';
type SortDirection = 'asc' | 'desc';

// Sectors commonly found in NASDAQ
const NASDAQ_SECTORS = [
  'All Sectors',
  'Technology',
  'Healthcare',
  'Consumer Discretionary',
  'Communication Services',
  'Financials',
  'Industrials',
  'Consumer Staples',
  'Energy',
  'Utilities',
  'Real Estate',
  'Materials'
];

export const StockScreener: React.FC = () => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<StockFilters>({
    sector: 'All Sectors',
    minPE: null,
    maxPE: null,
    minForwardPE: null,
    maxForwardPE: null,
    minMarketCap: null,
    maxMarketCap: null,
    minExpectedGrowth: null
  });

  const [sortField, setSortField] = useState<SortField>('valueScore');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Fetch stock data
  const { data: stockData = [], isLoading, error, refetch } = useQuery({
    queryKey: ['stock-screener', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      if (filters.sector !== 'All Sectors') {
        params.append('sector', filters.sector);
      }
      if (filters.minPE) params.append('minPE', filters.minPE.toString());
      if (filters.maxPE) params.append('maxPE', filters.maxPE.toString());
      if (filters.minForwardPE) params.append('minForwardPE', filters.minForwardPE.toString());
      if (filters.maxForwardPE) params.append('maxForwardPE', filters.maxForwardPE.toString());
      if (filters.minMarketCap) params.append('minMarketCap', filters.minMarketCap.toString());
      if (filters.maxMarketCap) params.append('maxMarketCap', filters.maxMarketCap.toString());
      
      const response = await api.get('/stocks/screener?' + params.toString());
      const stocks = response.data?.data || [];
      
      // Calculate expected growth and value score for each stock
      return stocks.map((stock: any) => ({
        ...stock,
        expectedGrowth: calculateExpectedGrowth(stock),
        valueScore: calculateValueScore(stock)
      }));
    }
  });

  // Add to favorites mutation
  const addFavoriteMutation = useMutation({
    mutationFn: async (symbol: string) => {
      const response = await api.post(`/stocks/favorites/${symbol}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-screener'] });
    }
  });

  // Remove from favorites mutation
  const removeFavoriteMutation = useMutation({
    mutationFn: async (symbol: string) => {
      const response = await api.delete(`/stocks/favorites/${symbol}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-screener'] });
    }
  });

  // Toggle favorite function
  const toggleFavorite = async (stock: StockData) => {
    if (stock.isFavorite) {
      await removeFavoriteMutation.mutateAsync(stock.symbol);
    } else {
      await addFavoriteMutation.mutateAsync(stock.symbol);
    }
  };

  // Calculate expected growth based on P/E metrics and revenue guidance
  const calculateExpectedGrowth = (stock: any): number => {
    const peGrowth = stock.pe && stock.forwardPE && stock.pe > 0 
      ? ((stock.pe - stock.forwardPE) / stock.pe) * 100 
      : 0;
    
    const revenueGrowth = stock.currentRevenue && stock.guidedRevenue && stock.currentRevenue > 0
      ? ((stock.guidedRevenue - stock.currentRevenue) / stock.currentRevenue) * 100
      : 0;
    
    const epsGrowth = stock.eps && stock.forwardEps && stock.eps > 0
      ? ((stock.forwardEps - stock.eps) / stock.eps) * 100
      : 0;
    
    // Weighted average: 40% P/E growth, 40% revenue growth, 20% EPS growth
    return (peGrowth * 0.4) + (revenueGrowth * 0.4) + (epsGrowth * 0.2);
  };

  // Calculate value score (higher is better value)
  const calculateValueScore = (stock: any): number => {
    let score = 0;
    
    // Low P/E ratio (compared to market average of ~20)
    if (stock.pe && stock.pe > 0 && stock.pe < 20) {
      score += (20 - stock.pe) * 2;
    }
    
    // Low forward P/E
    if (stock.forwardPE && stock.forwardPE > 0 && stock.forwardPE < 18) {
      score += (18 - stock.forwardPE) * 2;
    }
    
    // Positive expected growth
    if (stock.expectedGrowth > 0) {
      score += Math.min(stock.expectedGrowth, 30); // Cap at 30 points
    }
    
    // Low price to book ratio
    if (stock.priceToBook && stock.priceToBook < 3) {
      score += (3 - stock.priceToBook) * 5;
    }
    
    // Low debt to equity
    if (stock.debtToEquity && stock.debtToEquity < 1) {
      score += (1 - stock.debtToEquity) * 10;
    }
    
    return Math.max(0, Math.min(100, score)); // Normalize to 0-100
  };

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let filtered = stockData;
    
    // Apply minimum expected growth filter
    if (filters.minExpectedGrowth) {
      filtered = filtered.filter(stock => stock.expectedGrowth >= filters.minExpectedGrowth);
    }
    
    // Sort data
    const sorted = [...filtered].sort((a, b) => {
      const aValue = a[sortField] || 0;
      const bValue = b[sortField] || 0;
      
      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    
    return sorted;
  }, [stockData, filters.minExpectedGrowth, sortField, sortDirection]);

  // Paginate data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAndSortedData.slice(startIndex, endIndex);
  }, [filteredAndSortedData, currentPage]);

  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const formatCurrency = (value: number): string => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return `$${value.toFixed(2)}`;
  };

  const formatNumber = (value: number | null): string => {
    if (value === null || value === undefined) return 'N/A';
    return value.toFixed(2);
  };

  const exportData = () => {
    const csv = [
      ['Symbol', 'Name', 'Sector', 'Price', 'P/E', 'Forward P/E', 'Current Revenue', 'Guided Revenue', 'Expected Growth', 'Value Score'],
      ...filteredAndSortedData.map(stock => [
        stock.symbol,
        stock.name,
        stock.sector,
        stock.price.toFixed(2),
        formatNumber(stock.pe),
        formatNumber(stock.forwardPE),
        formatCurrency(stock.currentRevenue),
        stock.guidedRevenue ? formatCurrency(stock.guidedRevenue) : 'N/A',
        formatNumber(stock.expectedGrowth) + '%',
        stock.valueScore.toFixed(1)
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nasdaq-undervalued-stocks-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <PageContainer>
        <PageHeader
          title="Stock Screener"
          subtitle="Find undervalued NASDAQ stocks"
        />
        <LoadingState message="Loading stock data..." />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <PageHeader
          title="Stock Screener"
          subtitle="Find undervalued NASDAQ stocks"
        />
        <EmptyState
          icon={<Activity className="w-12 h-12 text-muted-foreground" />}
          title="Failed to Load Stock Data"
          description="Unable to fetch stock data. Please try again."
          actions={[{
            label: 'Retry',
            onClick: () => refetch()
          }]}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Stock Screener"
        subtitle="Find undervalued NASDAQ stocks with growth potential"
        actions={[
          {
            label: 'Refresh',
            icon: <RefreshCw className="h-4 w-4" />,
            onClick: () => refetch(),
            variant: 'outline' as const
          },
          {
            label: 'Export',
            icon: <Download className="h-4 w-4" />,
            onClick: exportData,
            variant: 'outline' as const
          }
        ]}
      />

      {/* Filters */}
      <ModernCard className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Sector Filter */}
            <div>
              <Label htmlFor="sector">Sector</Label>
              <Select 
                value={filters.sector} 
                onValueChange={(value) => setFilters({ ...filters, sector: value })}
              >
                <SelectTrigger id="sector">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NASDAQ_SECTORS.map(sector => (
                    <SelectItem key={sector} value={sector}>
                      {sector}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* P/E Range */}
            <div>
              <Label>P/E Range</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={filters.minPE || ''}
                  onChange={(e) => setFilters({ ...filters, minPE: e.target.value ? Number(e.target.value) : null })}
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={filters.maxPE || ''}
                  onChange={(e) => setFilters({ ...filters, maxPE: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
            </div>

            {/* Forward P/E Range */}
            <div>
              <Label>Forward P/E Range</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={filters.minForwardPE || ''}
                  onChange={(e) => setFilters({ ...filters, minForwardPE: e.target.value ? Number(e.target.value) : null })}
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={filters.maxForwardPE || ''}
                  onChange={(e) => setFilters({ ...filters, maxForwardPE: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
            </div>

            {/* Expected Growth Filter */}
            <div>
              <Label htmlFor="minGrowth">Min Expected Growth (%)</Label>
              <Input
                id="minGrowth"
                type="number"
                placeholder="e.g., 10"
                value={filters.minExpectedGrowth || ''}
                onChange={(e) => setFilters({ ...filters, minExpectedGrowth: e.target.value ? Number(e.target.value) : null })}
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <ModernButton
              variant="outline"
              size="sm"
              onClick={() => setFilters({
                sector: 'All Sectors',
                minPE: null,
                maxPE: null,
                minForwardPE: null,
                maxForwardPE: null,
                minMarketCap: null,
                maxMarketCap: null,
                minExpectedGrowth: null
              })}
            >
              Clear Filters
            </ModernButton>
          </div>
        </CardContent>
      </ModernCard>

      {/* Results Summary */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Found {filteredAndSortedData.length} stocks matching your criteria
        </p>
        <Badge variant="outline">
          Page {currentPage} of {totalPages}
        </Badge>
      </div>

      {/* Stock Table */}
      <ModernCard>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Star className="h-4 w-4" />
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('symbol')}
                  >
                    <div className="flex items-center gap-1">
                      Symbol
                      {sortField === 'symbol' && (
                        sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 text-right"
                    onClick={() => handleSort('price')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Price
                      {sortField === 'price' && (
                        sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 text-right"
                    onClick={() => handleSort('pe')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      P/E
                      {sortField === 'pe' && (
                        sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 text-right"
                    onClick={() => handleSort('forwardPE')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Fwd P/E
                      {sortField === 'forwardPE' && (
                        sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Guided Rev</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 text-right"
                    onClick={() => handleSort('expectedGrowth')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Growth
                      {sortField === 'expectedGrowth' && (
                        sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 text-right"
                    onClick={() => handleSort('valueScore')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Value Score
                      {sortField === 'valueScore' && (
                        sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((stock) => (
                  <TableRow key={stock.symbol}>
                    <TableCell className="w-12">
                      <button
                        onClick={() => toggleFavorite(stock)}
                        className="p-1 hover:bg-muted rounded transition-colors"
                        disabled={addFavoriteMutation.isPending || removeFavoriteMutation.isPending}
                      >
                        <Star 
                          className={`h-4 w-4 transition-colors ${
                            stock.isFavorite 
                              ? 'fill-yellow-500 text-yellow-500' 
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        />
                      </button>
                    </TableCell>
                    <TableCell className="font-medium">
                      <Badge variant="outline">{stock.symbol}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {stock.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {stock.sector}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${stock.price.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNumber(stock.pe)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNumber(stock.forwardPE)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(stock.currentRevenue)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {stock.guidedRevenue ? formatCurrency(stock.guidedRevenue) : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {stock.expectedGrowth > 0 ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                        <span className={stock.expectedGrowth > 0 ? 'text-green-600' : 'text-red-600'}>
                          {formatNumber(stock.expectedGrowth)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge 
                        variant={
                          stock.valueScore >= 70 ? 'success' :
                          stock.valueScore >= 50 ? 'warning' :
                          'secondary'
                        }
                      >
                        {stock.valueScore.toFixed(1)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t flex items-center justify-between">
              <ModernButton
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </ModernButton>
              
              <div className="flex items-center gap-2">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = currentPage <= 3 ? i + 1 : currentPage + i - 2;
                  if (pageNum > totalPages) return null;
                  return (
                    <ModernButton
                      key={pageNum}
                      variant={pageNum === currentPage ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </ModernButton>
                  );
                })}
              </div>
              
              <ModernButton
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </ModernButton>
            </div>
          )}
        </CardContent>
      </ModernCard>

      {/* Legend */}
      <ModernCard className="mt-6">
        <CardHeader>
          <CardTitle className="text-sm">Understanding the Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Expected Growth</h4>
              <p className="text-muted-foreground">
                Calculated based on P/E ratio improvement, revenue guidance, and EPS growth. 
                Higher values indicate stronger growth potential.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Value Score</h4>
              <p className="text-muted-foreground">
                A composite score (0-100) based on P/E ratios, price-to-book, debt levels, and growth potential. 
                Higher scores indicate better value opportunities.
              </p>
            </div>
          </div>
        </CardContent>
      </ModernCard>
    </PageContainer>
  );
};