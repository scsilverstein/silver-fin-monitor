// Entity Analytics Demo - Shows how to use analytics features in existing components
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { EntityLink, TopicLink } from '../navigation/ClickableLinks';
import { Badge } from '../ui/Badge';
import { TrendingUp, Users, BarChart3 } from 'lucide-react';

export const EntityAnalyticsDemo: React.FC = () => {
  // Sample entities that might be found in processed content
  const sampleEntities = [
    { name: 'Apple Inc.', type: 'company' },
    { name: 'AAPL', type: 'ticker' },
    { name: 'Tim Cook', type: 'person' },
    { name: 'Federal Reserve', type: 'organization' },
    { name: 'Bitcoin', type: 'crypto' },
    { name: 'S&P 500', type: 'index' },
  ];

  const sampleTopics = [
    'artificial intelligence',
    'market volatility',
    'earnings report',
    'inflation data',
    'supply chain',
    'renewable energy'
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Entity Analytics Integration
          </CardTitle>
          <p className="text-sm text-gray-600">
            Example of how entities now link to both content and analytics
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Entity Links Demo */}
          <div>
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Entity Links with Analytics Option
            </h3>
            <div className="space-y-4">
              
              <div>
                <h4 className="text-sm font-medium mb-2 text-gray-700">Content Links (Blue - Default)</h4>
                <div className="flex flex-wrap gap-2">
                  {sampleEntities.map((entity, index) => (
                    <EntityLink
                      key={index}
                      entity={entity}
                      linkTo="content"
                      size="sm"
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Click to filter content by entity (existing behavior)
                </p>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2 text-gray-700">Analytics Links (Purple - New!)</h4>
                <div className="flex flex-wrap gap-2">
                  {sampleEntities.map((entity, index) => (
                    <EntityLink
                      key={index}
                      entity={entity}
                      linkTo="analytics"
                      size="sm"
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Click to view trending and sentiment analytics for entity
                </p>
              </div>
            </div>
          </div>

          {/* Topic Links Demo */}
          <div>
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Topic Links (Content Only)
            </h3>
            <div className="flex flex-wrap gap-2">
              {sampleTopics.map((topic, index) => (
                <TopicLink
                  key={index}
                  topic={topic}
                  size="sm"
                />
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Topics filter content - analytics coming soon!
            </p>
          </div>

          {/* Usage Examples */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium mb-2">Integration Examples</h4>
            <div className="space-y-2 text-sm">
              <div>
                <strong>In ProcessedContent.tsx:</strong>
                <code className="ml-2 px-2 py-1 bg-white rounded text-xs">
                  &lt;EntityLink entity="Apple Inc." linkTo="analytics" /&gt;
                </code>
              </div>
              <div>
                <strong>In FeedCard.tsx:</strong>
                <code className="ml-2 px-2 py-1 bg-white rounded text-xs">
                  &lt;EntityLink entity="TSLA" linkTo="content" /&gt;
                </code>
              </div>
              <div>
                <strong>In Dashboard insights:</strong>
                <code className="ml-2 px-2 py-1 bg-white rounded text-xs">
                  &lt;EntityLink entity="Tesla" linkTo="analytics" size="md" /&gt;
                </code>
              </div>
            </div>
          </div>

          {/* Navigation Info */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Entity Analytics Dashboard</h4>
                <p className="text-sm text-gray-600">
                  Access via navigation: Entities → View trending, sentiment, and comparisons
                </p>
              </div>
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                Available Now
              </Badge>
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  );
};