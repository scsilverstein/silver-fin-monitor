import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { StockScannerResults } from '@/components/stocks/StockScannerResults';
import { useStockStore } from '@/store/stock.store';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertCircle, 
  TrendingUp, 
  Activity,
  RefreshCw,
  Search,
  Star,
  BarChart3
} from 'lucide-react';

export const StockScannerPage: React.FC = () => {
  const { 
    scannerResults, 
    watchlist,
    loading, 
    error, 
    fetchScannerResults,
    fetchWatchlist,
    runScanner 
  } = useStockStore();
  const [scanning, setScanning] = useState(false);
  const [activeTab, setActiveTab] = useState('momentum');

  useEffect(() => {
    fetchScannerResults();
    fetchWatchlist();
  }, [fetchScannerResults, fetchWatchlist]);

  const handleRunScanner = async () => {
    setScanning(true);
    try {
      await runScanner();
      await fetchScannerResults(); // Refresh results
    } finally {
      setScanning(false);
    }
  };

  const momentumStocks = scannerResults.filter(
    result => result.scanType === 'bullish_momentum' && result.compositeScore > 70
  );

  const valueStocks = scannerResults.filter(
    result => result.scanType === 'value_opportunity' && result.compositeScore > 70
  );

  const divergenceStocks = scannerResults.filter(
    result => result.scanType === 'bearish_divergence' && result.compositeScore > 70
  );

  if (loading && scannerResults.length === 0) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Activity className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Stock Scanner</h1>
            <p className="text-muted-foreground">
              AI-powered stock analysis and peer comparison
            </p>
          </div>
        </div>
        <Button onClick={handleRunScanner} disabled={scanning}>
          {scanning ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              Run Scanner
            </>
          )}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span>Bullish Momentum</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{momentumStocks.length}</div>
            <p className="text-xs text-muted-foreground">
              Stocks with strong earnings momentum
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-4 w-4 text-blue-500" />
                <span>Value Opportunities</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{valueStocks.length}</div>
            <p className="text-xs text-muted-foreground">
              Undervalued stocks vs peers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              <div className="flex items-center space-x-2">
                <Star className="h-4 w-4 text-yellow-500" />
                <span>Watchlist</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{watchlist.length}</div>
            <p className="text-xs text-muted-foreground">
              Stocks you're monitoring
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full max-w-lg grid-cols-4">
          <TabsTrigger value="momentum">Momentum</TabsTrigger>
          <TabsTrigger value="value">Value</TabsTrigger>
          <TabsTrigger value="divergence">Divergence</TabsTrigger>
          <TabsTrigger value="all">All Results</TabsTrigger>
        </TabsList>

        <TabsContent value="momentum" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bullish Momentum Stocks</CardTitle>
              <CardDescription>
                Stocks showing strong positive earnings revisions and momentum
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StockScannerResults 
                results={momentumStocks}
                showFilters={false}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="value" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Value Opportunities</CardTitle>
              <CardDescription>
                Stocks trading at attractive valuations compared to peers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StockScannerResults 
                results={valueStocks}
                showFilters={false}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="divergence" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bearish Divergence</CardTitle>
              <CardDescription>
                Stocks showing negative trends vs their peer groups
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StockScannerResults 
                results={divergenceStocks}
                showFilters={false}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Scanner Results</CardTitle>
              <CardDescription>
                Complete list of all scanned stocks with filtering options
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StockScannerResults 
                results={scannerResults}
                showFilters={true}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};