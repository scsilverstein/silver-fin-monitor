// Main dashboard page following CLAUDE.md specification
import React, { useEffect } from 'react';
import { useDashboardStore } from '../store';
import { DashboardOverview } from '../components/dashboard/DashboardOverview';
import { MarketSentimentChart } from '../components/dashboard/MarketSentimentChart';
import { FeedList } from '../components/feeds/FeedList';
import { StockScannerResults } from '../components/stocks/StockScannerResults';
import { PredictionsDisplay } from '../components/analysis/PredictionsDisplay';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { 
  RefreshCw, 
  Activity, 
  FileText, 
  TrendingUp, 
  Target,
  BarChart3,
  Bell
} from 'lucide-react';

export const DashboardNew: React.FC = () => {
  const { setRefreshInterval, refreshAll } = useDashboardStore();

  useEffect(() => {
    // Set up auto-refresh every 5 minutes
    setRefreshInterval(5 * 60 * 1000);
    
    return () => {
      setRefreshInterval(null);
    };
  }, [setRefreshInterval]);

  const handleManualRefresh = () => {
    refreshAll();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time market intelligence and analysis
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Activity className="h-3 w-3" />
            Live
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="icon"
          >
            <Bell className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Overview Section */}
      <DashboardOverview />

      {/* Main Content Tabs */}
      <Tabs defaultValue="analysis" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="analysis" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Analysis
          </TabsTrigger>
          <TabsTrigger value="feeds" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Feeds
          </TabsTrigger>
          <TabsTrigger value="stocks" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Stocks
          </TabsTrigger>
          <TabsTrigger value="predictions" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Predictions
          </TabsTrigger>
        </TabsList>

        {/* Analysis Tab */}
        <TabsContent value="analysis" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <MarketSentimentChart days={30} />
            
            <Card>
              <CardHeader>
                <CardTitle>Key Market Themes</CardTitle>
                <CardDescription>Emerging topics from today's analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <KeyThemesDisplay />
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Topic Evolution</CardTitle>
              <CardDescription>How key themes have changed over time</CardDescription>
            </CardHeader>
            <CardContent>
              <TopicEvolutionChart />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Feeds Tab */}
        <TabsContent value="feeds" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Feeds</CardTitle>
              <CardDescription>Latest content from all sources</CardDescription>
            </CardHeader>
            <CardContent>
              <FeedList limit={10} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stocks Tab */}
        <TabsContent value="stocks" className="space-y-6">
          <StockScannerResults />
        </TabsContent>

        {/* Predictions Tab */}
        <TabsContent value="predictions" className="space-y-6">
          <PredictionsDisplay showAccuracy={true} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Key Themes Component
const KeyThemesDisplay: React.FC = () => {
  const { keyThemes } = useDashboardStore();

  if (!keyThemes || keyThemes.length === 0) {
    return <p className="text-muted-foreground">No themes available</p>;
  }

  return (
    <div className="space-y-3">
      {keyThemes.slice(0, 5).map((theme, index) => (
        <div key={index} className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${
              theme.sentiment > 0 ? 'bg-green-500' : 
              theme.sentiment < 0 ? 'bg-red-500' : 
              'bg-gray-500'
            }`} />
            <span className="text-sm font-medium">{theme.theme}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {theme.frequency} mentions
            </Badge>
            <span className="text-xs text-muted-foreground">
              {theme.sources.length} sources
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

// Topic Evolution Chart Component
const TopicEvolutionChart: React.FC = () => {
  const { trends } = useDashboardStore();

  if (!trends || !trends.topicEvolution) {
    return <p className="text-muted-foreground">No topic data available</p>;
  }

  // This would be implemented with a proper chart
  return (
    <div className="h-64 flex items-center justify-center text-muted-foreground">
      Topic evolution visualization would go here
    </div>
  );
};

export default DashboardNew;