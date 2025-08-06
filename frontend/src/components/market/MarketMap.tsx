import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useStockStore } from '../../store/stock.store';

interface StockData {
  symbol: string;
  name: string;
  sector: string;
  marketCap: number;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
}

interface TreemapData extends d3.HierarchyRectangularNode<StockData> {
  data: StockData;
}

const MarketMap: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedStock, setSelectedStock] = useState<StockData | null>(null);
  const [colorMode, setColorMode] = useState<'performance' | 'sector'>('performance');
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedIndex, setSelectedIndex] = useState<string>('sp500');
  
  const { marketMapData, loading, error, fetchMarketMapData } = useStockStore();

  // Color scales
  const performanceColorScale = d3.scaleSequential(d3.interpolateRdYlGn)
    .domain([-5, 5]); // -5% to +5% change

  const sectorColorScale = d3.scaleOrdinal(d3.schemeCategory10);

  useEffect(() => {
    fetchMarketMapData(selectedIndex);
  }, [selectedIndex, fetchMarketMapData]);

  useEffect(() => {
    if (!marketMapData.length || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const width = dimensions.width - margin.left - margin.right;
    const height = dimensions.height - margin.top - margin.bottom;

    // Create hierarchy
    const root = d3.hierarchy({ children: marketMapData } as any)
      .sum(d => d.marketCap)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    // Create treemap
    const treemap = d3.treemap<StockData>()
      .size([width, height])
      .padding(2)
      .round(true);

    treemap(root);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create cells
    const leaf = g.selectAll('g')
      .data(root.leaves())
      .join('g')
      .attr('transform', d => `translate(${d.x0},${d.y0})`);

    // Add rectangles
    leaf.append('rect')
      .attr('fill', d => {
        if (colorMode === 'performance') {
          return performanceColorScale(d.data.changePercent);
        } else {
          return sectorColorScale(d.data.sector);
        }
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .attr('width', d => d.x1 - d.x0)
      .attr('height', d => d.y1 - d.y0)
      .attr('cursor', 'pointer')
      .on('click', (event, d) => {
        setSelectedStock(d.data);
      })
      .on('mouseover', function(event, d) {
        d3.select(this).attr('stroke-width', 3);
      })
      .on('mouseout', function(event, d) {
        d3.select(this).attr('stroke-width', 1);
      });

    // Add text labels
    leaf.append('text')
      .attr('x', 4)
      .attr('y', 14)
      .attr('font-size', d => {
        const area = (d.x1 - d.x0) * (d.y1 - d.y0);
        if (area < 2000) return '10px';
        if (area < 5000) return '12px';
        return '14px';
      })
      .attr('font-weight', 'bold')
      .attr('fill', 'white')
      .attr('text-shadow', '1px 1px 2px rgba(0,0,0,0.7)')
      .text(d => d.data.symbol);

    // Add change percentage
    leaf.append('text')
      .attr('x', 4)
      .attr('y', 28)
      .attr('font-size', d => {
        const area = (d.x1 - d.x0) * (d.y1 - d.y0);
        if (area < 2000) return '8px';
        if (area < 5000) return '10px';
        return '12px';
      })
      .attr('fill', 'white')
      .attr('text-shadow', '1px 1px 2px rgba(0,0,0,0.7)')
      .text(d => `${d.data.changePercent > 0 ? '+' : ''}${d.data.changePercent.toFixed(2)}%`);

  }, [marketMapData, dimensions, colorMode]);

  const refreshData = () => {
    fetchMarketMapData(selectedIndex);
  };

  const formatNumber = (num: number) => {
    if (num >= 1e12) return `$${(num / 1e12).toFixed(1)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
    return `$${num.toLocaleString()}`;
  };

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (change < 0) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-500" />;
  };

  const getTrendColor = (change: number) => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">S&P 500 Market Map</h1>
          <p className="text-gray-600">Visual representation of market performance by market cap</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 mr-4">
            <Button
              variant={selectedIndex === 'sp500' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setSelectedIndex('sp500')}
            >
              S&P 500
            </Button>
            <Button
              variant={selectedIndex === 'nasdaq' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setSelectedIndex('nasdaq')}
            >
              NASDAQ
            </Button>
            <Button
              variant={selectedIndex === 'dow' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setSelectedIndex('dow')}
            >
              DOW
            </Button>
          </div>
          <Button
            variant={colorMode === 'performance' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setColorMode('performance')}
          >
            Performance
          </Button>
          <Button
            variant={colorMode === 'sector' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setColorMode('sector')}
          >
            Sector
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-1 gap-6">
        <div className="flex-1">
          <Card>
            <CardContent className="p-4">
              {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded">
                  {error}
                </div>
              )}
              {loading && (
                <div className="flex items-center justify-center h-96">
                  <div className="text-center">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
                    <p className="text-gray-600">Loading market data...</p>
                  </div>
                </div>
              )}
              {!loading && !error && (
                <svg
                  ref={svgRef}
                  width={dimensions.width}
                  height={dimensions.height}
                  className="border rounded"
                  style={{ backgroundColor: '#f8f9fa' }}
                />
              )}
              
              {/* Legend */}
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Size represents market capitalization
                </div>
                {colorMode === 'performance' && (
                  <div className="flex items-center space-x-2 text-sm">
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-red-500 rounded mr-1"></div>
                      <span>Negative</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-yellow-500 rounded mr-1"></div>
                      <span>Neutral</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-green-500 rounded mr-1"></div>
                      <span>Positive</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stock Details Panel */}
        {selectedStock && (
          <div className="w-80">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-lg font-bold">{selectedStock.symbol}</span>
                      {getTrendIcon(selectedStock.changePercent)}
                    </div>
                    <div className="text-sm text-gray-600 font-normal">
                      {selectedStock.name}
                    </div>
                  </div>
                  <Badge variant="secondary">{selectedStock.sector}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Price</div>
                    <div className="text-lg font-semibold">
                      ${selectedStock.price.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Change</div>
                    <div className={`text-lg font-semibold ${getTrendColor(selectedStock.changePercent)}`}>
                      {selectedStock.change > 0 ? '+' : ''}${selectedStock.change.toFixed(2)}
                      ({selectedStock.changePercent > 0 ? '+' : ''}{selectedStock.changePercent.toFixed(2)}%)
                    </div>
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-gray-600">Market Cap</div>
                  <div className="text-lg font-semibold">
                    {formatNumber(selectedStock.marketCap * 1000000)}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-gray-600">Volume</div>
                  <div className="text-lg font-semibold">
                    {selectedStock.volume.toLocaleString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketMap;