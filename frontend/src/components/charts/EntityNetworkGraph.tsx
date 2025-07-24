import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { ChartBase } from './ChartBase';
import { Network, TrendingUp, TrendingDown, Users } from 'lucide-react';

interface EntityNode {
  id: string;
  name: string;
  type: 'company' | 'person' | 'location';
  mentionCount: number;
  avgSentiment: number;
  volatility: number;
  x?: number;
  y?: number;
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
  width?: number;
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
  width,
  loading = false,
  error = null,
  onRefresh,
  onNodeClick
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const { stats, sentimentLeaders, clusters } = useMemo(() => {
    if (!nodes.length) return { stats: null, sentimentLeaders: [], clusters: [] };

    // Calculate network statistics
    const totalMentions = nodes.reduce((sum, n) => sum + n.mentionCount, 0);
    const avgSentiment = nodes.reduce((sum, n) => sum + n.avgSentiment * n.mentionCount, 0) / totalMentions;
    
    // Find sentiment leaders (high mention count + extreme sentiment)
    const sentimentLeaders = nodes
      .filter(n => Math.abs(n.avgSentiment) > 0.5 && n.mentionCount > nodes.length * 0.1)
      .sort((a, b) => b.mentionCount - a.mentionCount)
      .slice(0, 5);

    // Simple clustering by sentiment similarity
    const clusters = detectClusters(nodes, edges);

    return {
      stats: {
        nodeCount: nodes.length,
        edgeCount: edges.length,
        avgSentiment,
        density: (2 * edges.length) / (nodes.length * (nodes.length - 1))
      },
      sentimentLeaders,
      clusters
    };
  }, [nodes, edges]);

  useEffect(() => {
    if (!svgRef.current || !nodes.length || loading) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const containerWidth = width || svgRef.current.clientWidth;
    const containerHeight = height;

    const g = svg.append("g");

    // Create zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom as any);

    // Create force simulation
    const simulation = d3.forceSimulation(nodes as any)
      .force("link", d3.forceLink(edges)
        .id((d: any) => d.id)
        .distance((d: any) => 100 / (d.sentimentCorrelation + 0.1))
        .strength((d: any) => d.sentimentCorrelation))
      .force("charge", d3.forceManyBody()
        .strength((d: any) => -300 * Math.sqrt(d.mentionCount / 10)))
      .force("center", d3.forceCenter(containerWidth / 2, containerHeight / 2))
      .force("collision", d3.forceCollide()
        .radius((d: any) => getNodeRadius(d) + 5));

    // Create edges
    const link = g.append("g")
      .selectAll("line")
      .data(edges)
      .enter().append("line")
      .attr("stroke", (d) => getEdgeColor(d.sentimentCorrelation))
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", (d) => Math.sqrt(d.coMentionCount) / 2);

    // Create nodes
    const node = g.append("g")
      .selectAll("g")
      .data(nodes)
      .enter().append("g")
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended) as any);

    // Add circles for nodes
    node.append("circle")
      .attr("r", (d) => getNodeRadius(d))
      .attr("fill", (d) => getNodeColor(d))
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .on("click", (event, d) => {
        setSelectedNode(d.id);
        onNodeClick?.(d);
      })
      .on("mouseenter", (event, d) => setHoveredNode(d.id))
      .on("mouseleave", () => setHoveredNode(null));

    // Add labels
    node.append("text")
      .text((d) => d.name)
      .attr("font-size", "10px")
      .attr("dx", (d) => getNodeRadius(d) + 3)
      .attr("dy", 3);

    // Add sentiment indicators
    node.append("path")
      .attr("d", (d) => getSentimentIcon(d))
      .attr("fill", "white")
      .attr("transform", (d) => `translate(-6, -6) scale(0.5)`);

    // Update positions on tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [nodes, edges, loading, height, width, onNodeClick]);

  const getNodeRadius = (node: EntityNode) => {
    const baseRadius = 10;
    const scaleFactor = Math.sqrt(node.mentionCount / 10);
    return Math.min(baseRadius + scaleFactor, 40);
  };

  const getNodeColor = (node: EntityNode) => {
    if (node.avgSentiment > 0.3) return '#10B981';
    if (node.avgSentiment < -0.3) return '#EF4444';
    return '#6B7280';
  };

  const getEdgeColor = (correlation: number) => {
    if (correlation > 0.7) return '#3B82F6';
    if (correlation > 0.3) return '#60A5FA';
    return '#E5E7EB';
  };

  const getSentimentIcon = (node: EntityNode) => {
    if (node.avgSentiment > 0.3) return "M7 11V13L12 8L7 3V5C3.93 5 1.5 7.43 1.5 10.5C1.5 11.5 1.77 12.45 2.24 13.24L3.7 11.78C3.58 11.37 3.5 10.94 3.5 10.5C3.5 8.54 5.04 7 7 7"; // Up arrow
    if (node.avgSentiment < -0.3) return "M7 13V11L12 16L7 21V19C3.93 19 1.5 16.57 1.5 13.5C1.5 12.5 1.77 11.55 2.24 10.76L3.7 12.22C3.58 12.63 3.5 13.06 3.5 13.5C3.5 15.46 5.04 17 7 17"; // Down arrow
    return "M4 12H20"; // Neutral line
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

  if (sentimentLeaders.length > 0) {
    const leader = sentimentLeaders[0];
    badges.push({
      text: `Leader: ${leader.name}`,
      variant: leader.avgSentiment > 0 ? 'default' : 'destructive' as const,
      icon: leader.avgSentiment > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />
    });
  }

  return (
    <ChartBase
      title={title}
      subtitle={subtitle || `Network density: ${(stats?.density || 0).toFixed(2)} • Click and drag to explore`}
      height={height}
      loading={loading}
      error={error}
      badges={badges}
      onRefresh={onRefresh}
    >
      <svg
        ref={svgRef}
        width="100%"
        height={height}
        style={{ cursor: 'grab' }}
      />
      
      {selectedNode && (
        <div className="absolute top-4 right-4 bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg p-4 max-w-xs">
          <h4 className="font-semibold mb-2">
            {nodes.find(n => n.id === selectedNode)?.name}
          </h4>
          <div className="text-sm space-y-1">
            <p>Type: {nodes.find(n => n.id === selectedNode)?.type}</p>
            <p>Mentions: {nodes.find(n => n.id === selectedNode)?.mentionCount}</p>
            <p>Sentiment: {((nodes.find(n => n.id === selectedNode)?.avgSentiment || 0) * 100).toFixed(1)}%</p>
            <p>Volatility: {((nodes.find(n => n.id === selectedNode)?.volatility || 0) * 100).toFixed(1)}%</p>
          </div>
        </div>
      )}
    </ChartBase>
  );
};

// Helper function to detect clusters (simplified community detection)
function detectClusters(nodes: EntityNode[], edges: EntityEdge[]): string[][] {
  // Simple clustering based on high correlation connections
  const adjacencyList: Map<string, Set<string>> = new Map();
  
  edges.forEach(edge => {
    if (edge.sentimentCorrelation > 0.7) {
      if (!adjacencyList.has(edge.source)) adjacencyList.set(edge.source, new Set());
      if (!adjacencyList.has(edge.target)) adjacencyList.set(edge.target, new Set());
      adjacencyList.get(edge.source)!.add(edge.target);
      adjacencyList.get(edge.target)!.add(edge.source);
    }
  });
  
  const visited = new Set<string>();
  const clusters: string[][] = [];
  
  nodes.forEach(node => {
    if (!visited.has(node.id)) {
      const cluster: string[] = [];
      const queue = [node.id];
      
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (!visited.has(current)) {
          visited.add(current);
          cluster.push(current);
          
          const neighbors = adjacencyList.get(current);
          if (neighbors) {
            neighbors.forEach(neighbor => {
              if (!visited.has(neighbor)) {
                queue.push(neighbor);
              }
            });
          }
        }
      }
      
      if (cluster.length > 1) {
        clusters.push(cluster);
      }
    }
  });
  
  return clusters;
}