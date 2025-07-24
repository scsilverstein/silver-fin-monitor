import React, { useState } from 'react';
import { 
  PageContainer, 
  PageHeader, 
  StatsGrid, 
  LoadingState, 
  EmptyState,
  createStatItems,
  createPageActions 
} from '@/components/layout';
import { RefreshCw, FileText, BarChart3, Calendar, TrendingUp } from 'lucide-react';
import { useAnalysisData } from '@/hooks/useAnalysisData';
import { useAnalysisFilters } from '@/hooks/useAnalysisFilters';
import { AnalysisHeader } from '@/components/analysis/AnalysisHeader';
import { AnalysisStats } from '@/components/analysis/AnalysisStats';
import { AnalysisCard } from '@/components/analysis/AnalysisCard';
import { AnalysisDetails } from '@/components/analysis/AnalysisDetails';
import { AnalysisPagination } from '@/components/analysis/AnalysisPagination';
import { GenerateAnalysisModal } from '@/components/analysis/GenerateAnalysisModal';
import { ModernCard, CardContent } from '@/components/ui/ModernCard';
import { useNavigate } from 'react-router-dom';

export const ModernAnalysis: React.FC = () => {
  const navigate = useNavigate();
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [dateRange, setDateRange] = useState('all');
  
  const { 
    analyses, 
    loading, 
    refreshing, 
    currentPage, 
    totalPages,
    hasMore, 
    refreshAnalyses, 
    loadNextPage,
    loadPreviousPage,
    generateAnalysis
  } = useAnalysisData();
  
  const {
    filters,
    updateFilter,
    resetFilters,
    filteredAnalyses,
    expandedAnalyses,
    toggleExpanded,
    getSentimentColor,
    getConfidenceColor,
    searchQuery,
    setSearchQuery
  } = useAnalysisFilters(analyses);

  const handleGenerateAnalysis = async (date?: string) => {
    const result = await generateAnalysis(date);
    if (result) {
      alert(`Analysis generation queued! Job ID: ${result.jobId}`);
      // Refresh after a delay
      setTimeout(() => {
        refreshAnalyses();
      }, 5000);
    }
  };

  const handleViewDetails = (analysisId: string) => {
    // Navigate to predictions page with analysis filter
    navigate(`/predictions?analysisId=${analysisId}`);
  };

  const handleDateRangeChange = (value: string) => {
    setDateRange(value);
    // Calculate date range for API call
    let startDate: string | null = null;
    let endDate: string | null = null;
    
    const now = new Date();
    endDate = now.toISOString().split('T')[0];
    
    switch (value) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case 'all':
        // For "all", use a very old start date
        startDate = new Date('2024-01-01').toISOString().split('T')[0];
        break;
    }
    
    refreshAnalyses(startDate, endDate);
  };

  // Create stats for the analysis page
  const analysisStats = [
    createStatItems.count('total', 'Total Analyses', analyses.length, {
      icon: <BarChart3 className="h-4 w-4" />,
      status: analyses.length > 0 ? 'success' : 'warning'
    }),
    createStatItems.count('filtered', 'Filtered Results', filteredAnalyses.length, {
      icon: <FileText className="h-4 w-4" />,
      status: 'info'
    }),
    createStatItems.count('recent', 'This Week', 
      analyses.filter(a => {
        const analysisDate = new Date(a.analysis_date);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return analysisDate > weekAgo;
      }).length, {
      icon: <Calendar className="h-4 w-4" />,
      status: 'default'
    }),
    createStatItems.percentage('avg_confidence', 'Avg Confidence', 
      analyses.length > 0 
        ? Math.round(analyses.reduce((sum, a) => sum + (a.confidence_score || 0), 0) / analyses.length * 100)
        : 0
    )
  ];

  if (loading && analyses.length === 0) {
    return (
      <PageContainer showBreadcrumbs>
        <LoadingState message="Loading analyses..." fullScreen />
      </PageContainer>
    );
  }

  return (
    <PageContainer showBreadcrumbs>
      <PageHeader
        title="Market Analysis"
        subtitle="AI-generated market analysis and insights"
        badges={[
          { label: `${analyses.length} Total`, variant: 'outline' },
          { label: dateRange === 'all' ? 'All Time' : `Last ${dateRange}`, variant: 'info' }
        ]}
        showSearch={true}
        searchQuery={searchQuery}
        searchPlaceholder="Search analyses..."
        onSearchChange={setSearchQuery}
        onRefresh={() => refreshAnalyses()}
        refreshing={refreshing}
        primaryActions={[
          {
            label: 'Generate Analysis',
            icon: <BarChart3 className="h-4 w-4" />,
            onClick: () => setShowGenerateModal(true)
          }
        ]}
        secondaryActions={[
          createPageActions.settings(() => {})
        ]}
      />

      <StatsGrid stats={analysisStats} columns={4} loading={loading} />

      <div className="space-y-4">
        {loading && analyses.length > 0 && (
          <LoadingState message="Loading more analyses..." variant="refresh" size="sm" className="py-4" />
        )}
        
        {filteredAnalyses.length === 0 ? (
          searchQuery ? (
            <EmptyState
              icon={<FileText className="h-12 w-12 text-muted-foreground" />}
              title="No analyses found"
              description={`No analyses match your search for "${searchQuery}". Try adjusting your search terms.`}
              actions={[{
                label: 'Clear Search',
                onClick: () => setSearchQuery('')
              }]}
            />
          ) : analyses.length > 0 ? (
            <EmptyState
              icon={<FileText className="h-12 w-12 text-muted-foreground" />}
              title="No analyses found"
              description="All analyses have been filtered out. Try adjusting your filters."
              actions={[{
                label: 'Clear Filters',
                onClick: resetFilters
              }]}
            />
          ) : (
            <EmptyState
              icon={<BarChart3 className="h-12 w-12 text-muted-foreground" />}
              title="No analyses available"
              description="No analyses have been generated yet. Generate your first market analysis."
              actions={[{
                label: 'Generate Analysis',
                onClick: () => setShowGenerateModal(true),
                icon: <BarChart3 className="h-4 w-4" />
              }]}
            />
          )
        ) : (
            filteredAnalyses.map((analysis) => {
              const isExpanded = expandedAnalyses.has(analysis.id);
              return (
                <AnalysisCard
                  key={analysis.id}
                  analysis={analysis}
                  expanded={isExpanded}
                  getSentimentColor={getSentimentColor}
                  getConfidenceColor={getConfidenceColor}
                  onToggleExpand={() => toggleExpanded(analysis.id)}
                  onViewDetails={() => handleViewDetails(analysis.id)}
                >
                  <AnalysisDetails analysis={analysis} />
                </AnalysisCard>
              );
            })
          )}

          <AnalysisPagination
            currentPage={currentPage}
            totalPages={totalPages}
            hasMore={hasMore}
            onPreviousPage={loadPreviousPage}
            onNextPage={loadNextPage}
          />
        </div>

      <GenerateAnalysisModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        onGenerate={handleGenerateAnalysis}
      />
    </PageContainer>
  );
};