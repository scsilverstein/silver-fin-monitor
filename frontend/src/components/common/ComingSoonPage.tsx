import React from 'react';

interface ComingSoonPageProps {
  title: string;
  description?: string;
}

export const ComingSoonPage: React.FC<ComingSoonPageProps> = ({ 
  title, 
  description = 'Coming Soon' 
}) => {
  return (
    <div className="text-center py-20">
      <h1 className="text-3xl font-display font-bold text-gradient mb-4">
        {title}
      </h1>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
};