import React from 'react';
import { ModernCard, CardContent, CardHeader, CardTitle } from '@/components/ui/ModernCard';
import { ModernButton } from '@/components/ui/ModernButton';
import { ModernBadge } from '@/components/ui/ModernBadge';

export const TestCSS: React.FC = () => {
  return (
    <div className="min-h-screen p-8 space-y-8">
      {/* Test CSS Variables */}
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">CSS Test Page</h1>
        
        {/* Background Colors */}
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 bg-background border rounded">bg-background</div>
          <div className="p-4 bg-primary text-primary-foreground rounded">bg-primary</div>
          <div className="p-4 bg-secondary text-secondary-foreground rounded">bg-secondary</div>
          <div className="p-4 bg-muted rounded">bg-muted</div>
        </div>

        {/* Test Modern Components */}
        <div className="grid grid-cols-2 gap-4">
          <ModernCard>
            <CardHeader>
              <CardTitle>Modern Card Default</CardTitle>
            </CardHeader>
            <CardContent>
              <p>This is a default modern card</p>
            </CardContent>
          </ModernCard>

          <ModernCard variant="glass">
            <CardHeader>
              <CardTitle>Glass Card</CardTitle>
            </CardHeader>
            <CardContent>
              <p>This should have glass morphism effect</p>
            </CardContent>
          </ModernCard>

          <ModernCard variant="gradient">
            <CardHeader>
              <CardTitle>Gradient Card</CardTitle>
            </CardHeader>
            <CardContent>
              <p>This should have gradient background</p>
            </CardContent>
          </ModernCard>

          <ModernCard variant="bordered">
            <CardHeader>
              <CardTitle>Bordered Card</CardTitle>
            </CardHeader>
            <CardContent>
              <p>This should have a border</p>
            </CardContent>
          </ModernCard>
        </div>

        {/* Test Buttons */}
        <div className="flex gap-4 flex-wrap">
          <ModernButton>Default Button</ModernButton>
          <ModernButton variant="gradient">Gradient Button</ModernButton>
          <ModernButton variant="glow">Glow Button</ModernButton>
          <ModernButton variant="outline">Outline Button</ModernButton>
          <ModernButton variant="ghost">Ghost Button</ModernButton>
        </div>

        {/* Test Badges */}
        <div className="flex gap-4 flex-wrap">
          <ModernBadge>Default Badge</ModernBadge>
          <ModernBadge variant="primary">Primary Badge</ModernBadge>
          <ModernBadge variant="success">Success Badge</ModernBadge>
          <ModernBadge variant="warning">Warning Badge</ModernBadge>
          <ModernBadge variant="error">Error Badge</ModernBadge>
        </div>

        {/* Test Text Gradients */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gradient">Text Gradient</h2>
          <h2 className="text-2xl font-bold text-gradient-multicolor">Multicolor Gradient</h2>
        </div>

        {/* Test Glass Effect */}
        <div className="glass p-6 rounded-lg">
          <h3 className="text-xl font-semibold mb-2">Glass Effect</h3>
          <p>This div should have glass morphism effect with backdrop blur</p>
        </div>

        {/* Test Raw Styles */}
        <div className="space-y-2">
          <div style={{ backgroundColor: 'hsl(var(--background))' }} className="p-4 rounded">
            Direct HSL Background
          </div>
          <div style={{ backgroundColor: 'hsl(221 83% 53%)' }} className="p-4 rounded text-white">
            Direct Primary Color
          </div>
        </div>
      </div>
    </div>
  );
};