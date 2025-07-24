import React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { ModernButton } from './ModernButton';
import { ModernBadge } from './ModernBadge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';

export const ThemeToggle: React.FC = () => {
  const { theme, actualTheme, setTheme } = useTheme();

  const themeIcons = {
    light: Sun,
    dark: Moon,
    system: Monitor
  };

  const themeLabels = {
    light: 'Light',
    dark: 'Dark', 
    system: 'System'
  };

  const CurrentIcon = themeIcons[theme];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ModernButton 
          variant="ghost" 
          size="sm"
          className="relative hover-glow transition-all duration-300"
          title={`Current theme: ${themeLabels[theme]}`}
        >
          <CurrentIcon className="h-4 w-4 transition-transform duration-300 hover:rotate-12" />
          {theme === 'system' && (
            <ModernBadge 
              variant="secondary" 
              size="sm" 
              className="absolute -top-1 -right-1 text-xs animate-pulse"
            >
              AUTO
            </ModernBadge>
          )}
        </ModernButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 animate-in slide-in-down">
        <DropdownMenuItem 
          onClick={() => setTheme('light')}
          className="flex items-center gap-2 cursor-pointer hover-scale"
        >
          <Sun className="h-4 w-4" />
          <span>Light</span>
          {theme === 'light' && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme('dark')}
          className="flex items-center gap-2 cursor-pointer hover-scale"
        >
          <Moon className="h-4 w-4" />
          <span>Dark</span>
          {theme === 'dark' && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme('system')}
          className="flex items-center gap-2 cursor-pointer hover-scale"
        >
          <Monitor className="h-4 w-4" />
          <span>System</span>
          <ModernBadge variant="outline" size="sm" className="ml-auto">
            {actualTheme === 'dark' ? 'Dark' : 'Light'}
          </ModernBadge>
          {theme === 'system' && <span className="ml-1 text-xs">✓</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const QuickThemeToggle: React.FC = () => {
  const { toggleTheme, theme, actualTheme } = useTheme();
  
  return (
    <ModernButton
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className="relative group hover-glow transition-all duration-300"
      title="Toggle theme (Ctrl+Shift+T)"
    >
      {actualTheme === 'dark' ? (
        <Moon className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12" />
      ) : (
        <Sun className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12" />
      )}
      {theme === 'system' && (
        <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
      )}
    </ModernButton>
  );
};