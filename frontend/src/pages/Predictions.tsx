import React from 'react';
import { PageContainer, PageHeader, LoadingState, EmptyState, StatsGrid, createPageActions } from '@/components/layout';
import { Download, TrendingUp } from 'lucide-react';
import { usePredictionsData } from '@/hooks/usePredictionsData';
import { usePredictionsFilters } from '@/hooks/usePredictionsFilters';
import { useQueueTrigger, QueueTriggerType } from '@/hooks/useQueueTrigger';
import { exportPredictions } from '@/utils/predictionHelpers';
import { PredictionsFilters } from '@/components/predictions/PredictionsFilters';
import { PredictionsTabs } from '@/components/predictions/PredictionsTabs';
import { createStatItems } from '@/components/layout';
import { PredictionsSkeleton } from '@/components/predictions/PredictionsSkeleton';

const Predictions: React.FC = () => {
  const { 
    predictions, 
    loading, 
    generating, 
    latestAnalysis, 
    loadPredictions, 
    generatePredictions 
  } = usePredictionsData();

  // Trigger queue job when page loads
  const { triggerManually: triggerPredictionRefresh } = useQueueTrigger({
    type: QueueTriggerType.PREDICTION_REFRESH,
    cooldownMinutes: 60, // Daily predictions, so longer cooldown
    enabled: true
  });

  const {
    selectedHorizon,
    selectedType,
    filteredPredictions,
    groupedPredictions,
    availableHorizons,
    availableTypes,
    setSelectedHorizon,
    setSelectedType,
    getHorizonLabel,
    getTypeLabel,
    resetFilters
  } = usePredictionsFilters(predictions);

  const handleExport = () => exportPredictions(predictions);

  // Create stats for the predictions
  const predictionStats = [
    createStatItems.count('total', 'Total Predictions', predictions.length),
    createStatItems.count('filtered', 'Filtered Results', filteredPredictions.length),
    createStatItems.count('horizons', 'Time Horizons', availableHorizons.length),
    createStatItems.count('types', 'Prediction Types', availableTypes.length)
  ];

  if (loading) {
    return <PredictionsSkeleton />;
  }

  return (
    <PageContainer showBreadcrumbs>
      <div className="animate-in slide-in-up">
        <PageHeader
        title="Market Predictions"
        subtitle="AI-generated market forecasts and predictions"
        badges={[
          { label: 'Live', variant: 'info', dot: true },
          { label: `${predictions.length} Total`, variant: 'outline' }
        ]}
        onRefresh={async () => {
          await loadPredictions();
          await triggerPredictionRefresh();
        }}
        refreshing={loading}
        primaryActions={[
          {
            label: 'Generate Predictions',
            icon: <TrendingUp className="h-4 w-4" />,
            onClick: generatePredictions,
            loading: generating,
            disabled: !latestAnalysis
          }
        ]}
        secondaryActions={[
          createPageActions.export(handleExport, false)
        ]}
        />

        <div className="animate-in slide-in-up" style={{ animationDelay: '100ms' }}>
          <StatsGrid stats={predictionStats} columns={4} loading={loading} />
        </div>

        <div className="animate-in slide-in-up" style={{ animationDelay: '150ms' }}>
          <PredictionsFilters
        selectedHorizon={selectedHorizon}
        selectedType={selectedType}
        availableHorizons={availableHorizons}
        availableTypes={availableTypes}
        onHorizonChange={setSelectedHorizon}
        onTypeChange={setSelectedType}
        getHorizonLabel={getHorizonLabel}
        getTypeLabel={getTypeLabel}
        onReset={resetFilters}
          />
        </div>

        {filteredPredictions.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="h-12 w-12 text-muted-foreground" />}
          title="No predictions available"
          description={latestAnalysis 
            ? "Generate some market predictions based on your analyzed content." 
            : "You need to run daily analysis first before generating predictions."
          }
          actions={latestAnalysis ? [{
            label: 'Generate Predictions',
            onClick: generatePredictions,
            icon: <TrendingUp className="h-4 w-4" />
          }] : []}
        />
        ) : (
          <div className="animate-in slide-in-up" style={{ animationDelay: '200ms' }}>
            <PredictionsTabs 
              groupedPredictions={groupedPredictions}
              getHorizonLabel={getHorizonLabel}
            />
          </div>
        )}
      </div>
    </PageContainer>
  );
};

export default Predictions;