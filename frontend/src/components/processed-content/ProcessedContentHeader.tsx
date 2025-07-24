import React from 'react';

export const ProcessedContentHeader: React.FC = () => {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-display font-bold text-gradient">
          Processed Content
        </h1>
        <p className="text-muted-foreground mt-1">
          View and analyze processed content from all feed sources
        </p>
      </div>
    </div>
  );
};