import React from 'react';
import { ChartBase } from './ChartBase';
import { Network, TrendingUp, TrendingDown, Users } from 'lucide-react';

interface EntityNode {
  id: string;
  name: string;
  type: 'company' | 'person' | 'location';
  mentionCount: number;
  avgSentiment: number;
  volatility: number;
}

interface EntityEdge {
  source: string;
  target: string;
  coMentionCount: number;
  sentimentCorrelation: number;
  timelag?: number;
}

interface EntityNetworkGraphProps {
  nodes: EntityNode[];
  edges: EntityEdge[];
  title?: string;
  subtitle?: string;
  height?: number;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onNodeClick?: (node: EntityNode) => void;
}

export const EntityNetworkGraph: React.FC<EntityNetworkGraphProps> = ({
  nodes,
  edges,
  title = "Entity Relationship Network",
  subtitle,
  height = 600,
  loading = false,
  error = null,
  onRefresh,
  onNodeClick
}) => {
  // For now, display as a simple list view until d3 is properly configured
  const topNodes = nodes.slice(0, 10);
  
  const getNodeColor = (sentiment: number) => {
    if (sentiment > 0.3) return 'text-green-600';
    if (sentiment < -0.3) return 'text-red-600';
    return 'text-gray-600';
  };

  const badges = [
    { 
      text: `${nodes.length} Entities`, 
      variant: 'secondary' as const,
      icon: <Users className="w-3 h-3" />
    },
    { 
      text: `${edges.length} Connections`, 
      variant: 'secondary' as const,
      icon: <Network className="w-3 h-3" />
    }
  ];

  return (
    <ChartBase
      title={title}
      subtitle={subtitle || `Network analysis • Click entities for details`}
      height={height}
      loading={loading}
      error={error}
      badges={badges}
      onRefresh={onRefresh}
    >
      <div className="p-4">
        <div className="mb-4 text-sm text-muted-foreground">
          <p>Top entities by mention count. Full network visualization coming soon.</p>
        </div>
        
        <div className="space-y-3">
          {topNodes.map((node) => (
            <div
              key={node.id}
              onClick={() => onNodeClick?.(node)}
              className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  node.avgSentiment > 0.3 ? 'bg-green-100' : 
                  node.avgSentiment < -0.3 ? 'bg-red-100' : 'bg-gray-100'
                }`}>
                  {node.avgSentiment > 0.3 ? 
                    <TrendingUp className="w-5 h-5 text-green-600" /> :
                    node.avgSentiment < -0.3 ?
                    <TrendingDown className="w-5 h-5 text-red-600" /> :
                    <Users className="w-5 h-5 text-gray-600" />
                  }
                </div>
                <div>
                  <h4 className="font-semibold">{node.name}</h4>
                  <p className="text-sm text-muted-foreground capitalize">{node.type}</p>
                </div>
              </div>
              
              <div className="text-right">
                <p className="text-sm font-medium">{node.mentionCount} mentions</p>
                <p className={`text-sm ${getNodeColor(node.avgSentiment)}`}>
                  {(node.avgSentiment * 100).toFixed(1)}% sentiment
                </p>
              </div>
            </div>
          ))}
        </div>
        
        {edges.length > 0 && (
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <h4 className="text-sm font-semibold mb-2">Top Connections</h4>
            <div className="space-y-2">
              {edges.slice(0, 5).map((edge, index) => {
                const sourceNode = nodes.find(n => n.id === edge.source);
                const targetNode = nodes.find(n => n.id === edge.target);
                if (!sourceNode || !targetNode) return null;
                
                return (
                  <div key={index} className="text-sm">
                    <span className="font-medium">{sourceNode.name}</span>
                    <span className="mx-2 text-muted-foreground">↔</span>
                    <span className="font-medium">{targetNode.name}</span>
                    <span className="ml-2 text-muted-foreground">
                      ({edge.coMentionCount} co-mentions)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </ChartBase>
  );
};