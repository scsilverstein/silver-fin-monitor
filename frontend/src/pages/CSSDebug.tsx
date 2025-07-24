import React, { useEffect, useState } from 'react';

export const CSSDebug: React.FC = () => {
  const [cssVars, setCssVars] = useState<Record<string, string>>({});
  const [computedStyles, setComputedStyles] = useState<Record<string, string>>({});

  useEffect(() => {
    // Get CSS variables
    const root = document.documentElement;
    const styles = getComputedStyle(root);
    
    const vars: Record<string, string> = {};
    const cssProps = [
      '--background', '--foreground', '--primary', '--secondary',
      '--muted', '--accent', '--card', '--border', '--input', '--ring'
    ];
    
    cssProps.forEach(prop => {
      vars[prop] = styles.getPropertyValue(prop) || 'not defined';
    });
    
    setCssVars(vars);
    
    // Get computed styles for body
    const bodyStyles = getComputedStyle(document.body);
    setComputedStyles({
      backgroundColor: bodyStyles.backgroundColor,
      color: bodyStyles.color,
      fontFamily: bodyStyles.fontFamily,
    });
  }, []);

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold">CSS Debug Information</h1>
      
      {/* CSS Variables */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">CSS Variables</h2>
        <div className="font-mono text-sm space-y-1">
          {Object.entries(cssVars).map(([key, value]) => (
            <div key={key}>
              <span className="text-blue-600">{key}</span>: <span className="text-green-600">{value || 'undefined'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Computed Styles */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Body Computed Styles</h2>
        <div className="font-mono text-sm space-y-1">
          {Object.entries(computedStyles).map(([key, value]) => (
            <div key={key}>
              <span className="text-blue-600">{key}</span>: <span className="text-green-600">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Direct Style Tests */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Direct Style Tests</h2>
        
        {/* Using inline HSL */}
        <div style={{ 
          backgroundColor: 'hsl(221, 83%, 53%)',
          color: 'white',
          padding: '1rem',
          borderRadius: '0.5rem'
        }}>
          Inline HSL Primary Color
        </div>

        {/* Using CSS variable */}
        <div style={{ 
          backgroundColor: 'hsl(var(--primary))',
          color: 'white',
          padding: '1rem',
          borderRadius: '0.5rem'
        }}>
          CSS Variable Primary (should fail if var not defined)
        </div>

        {/* Tailwind classes */}
        <div className="bg-blue-500 text-white p-4 rounded">
          Tailwind Blue-500
        </div>

        {/* Custom utility */}
        <div className="bg-primary text-primary-foreground p-4 rounded">
          Tailwind Custom Primary
        </div>
      </div>

      {/* Check if Tailwind is loaded */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Tailwind Check</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-red-500 text-white rounded">Red</div>
          <div className="p-4 bg-green-500 text-white rounded">Green</div>
          <div className="p-4 bg-blue-500 text-white rounded">Blue</div>
        </div>
      </div>

      {/* Check custom classes */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Custom Classes</h2>
        <div className="glass p-4 rounded">
          Glass Effect (from index.css)
        </div>
        <div className="gradient-primary p-4 rounded">
          Gradient Primary (from index.css)
        </div>
      </div>
    </div>
  );
};