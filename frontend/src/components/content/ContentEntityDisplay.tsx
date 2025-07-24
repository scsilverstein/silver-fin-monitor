import React from 'react';
import { ModernBadge } from '@/components/ui/ModernBadge';
import { ProcessedContent } from '@/lib/api';
import { entityTypeConfig } from '@/config/entityTypes';

interface ContentEntityDisplayProps {
  content: ProcessedContent;
}

export const ContentEntityDisplay: React.FC<ContentEntityDisplayProps> = ({ content }) => {
  const { entities } = content;

  if (!entities) {
    return (
      <div className="text-sm text-muted-foreground">
        No entities extracted
      </div>
    );
  }

  // Handle both array format (new) and object format (legacy)
  let entityGroups: Record<string, Array<{ name: string; type: string; metadata?: Record<string, any> }>> = {};

  if (Array.isArray(entities)) {
    // New format: array of entity objects
    // Group entities by type
    entities.forEach((entity) => {
      if (entity && entity.type && entity.name) {
        if (!entityGroups[entity.type]) {
          entityGroups[entity.type] = [];
        }
        entityGroups[entity.type].push(entity);
      }
    });
  } else if (typeof entities === 'object') {
    // Legacy format: object with arrays
    Object.entries(entities).forEach(([type, items]) => {
      if (Array.isArray(items) && items.length > 0) {
        entityGroups[type] = items.map(item => ({
          name: typeof item === 'string' ? item : item.name || item,
          type: type
        }));
      }
    });
  }

  const entityTypes = Object.keys(entityGroups);
  if (entityTypes.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No entities extracted
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {entityTypes.map((type) => {
        const items = entityGroups[type];
        const config = entityTypeConfig[type as keyof typeof entityTypeConfig];
        
        if (!config || !items || items.length === 0) {
          return null;
        }

        const Icon = config.icon;

        return (
          <div key={type} className="space-y-2">
            <div className="flex items-center gap-2">
              <Icon className={`h-4 w-4 ${config.iconClass}`} />
              <span className="text-sm font-medium">{config.label}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {items.slice(0, 10).map((item, index) => (
                <ModernBadge 
                  key={index} 
                  variant={config.badgeVariant}
                  size="sm"
                  title={item.metadata ? JSON.stringify(item.metadata) : undefined}
                >
                  {item.name}
                </ModernBadge>
              ))}
              {items.length > 10 && (
                <ModernBadge variant="secondary" size="sm">
                  +{items.length - 10} more
                </ModernBadge>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};