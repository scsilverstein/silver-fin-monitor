import React from 'react';
import { ModernButton } from '@/components/ui/ModernButton';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ContentPaginationProps {
  currentPage: number;
  totalPages: number;
  hasMore: boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

export const ContentPagination: React.FC<ContentPaginationProps> = ({
  currentPage,
  totalPages,
  hasMore,
  onPreviousPage,
  onNextPage
}) => {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </div>
      
      <div className="flex gap-2">
        <ModernButton
          variant="outline"
          size="sm"
          onClick={onPreviousPage}
          disabled={currentPage <= 1}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </ModernButton>
        
        <ModernButton
          variant="outline"
          size="sm"
          onClick={onNextPage}
          disabled={!hasMore}
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </ModernButton>
      </div>
    </div>
  );
};