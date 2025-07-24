import React from 'react';
import { ModernButton } from '@/components/ui/ModernButton';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface AnalysisPaginationProps {
  currentPage: number;
  totalPages: number;
  hasMore: boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

export const AnalysisPagination: React.FC<AnalysisPaginationProps> = ({
  currentPage,
  totalPages,
  hasMore,
  onPreviousPage,
  onNextPage
}) => {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-4 mt-6">
      <ModernButton
        variant="outline"
        size="sm"
        icon={<ChevronLeft className="h-4 w-4" />}
        onClick={onPreviousPage}
        disabled={currentPage === 1}
      >
        Previous
      </ModernButton>
      
      <span className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </span>
      
      <ModernButton
        variant="outline"
        size="sm"
        iconRight={<ChevronRight className="h-4 w-4" />}
        onClick={onNextPage}
        disabled={!hasMore}
      >
        Next
      </ModernButton>
    </div>
  );
};