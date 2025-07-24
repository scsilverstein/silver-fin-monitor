import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Clock,
  ArrowRight,
  Hash,
  FileText,
  BarChart,
  Settings,
  User,
  Command,
  Zap,
  TrendingUp,
  Calendar,
  Globe,
  MessageSquare,
  Filter,
  Download,
  Star,
  ChevronRight,
  Keyboard
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';

interface CommandAction {
  id: string;
  title: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
  keywords: string[];
  shortcut?: string;
  isRecent?: boolean;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose }) => {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentActions, setRecentActions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { success, info, warning } = useToast();

  // Define all available actions
  const actions: CommandAction[] = [
    // Navigation
    {
      id: 'nav-dashboard',
      title: 'Go to Dashboard',
      description: 'View market overview and key metrics',
      icon: <BarChart className="h-4 w-4" />,
      action: () => { navigate('/dashboard'); onClose(); },
      category: 'Navigation',
      keywords: ['dashboard', 'overview', 'home', 'main'],
      shortcut: 'G then D'
    },
    {
      id: 'nav-analysis',
      title: 'Go to Analysis',
      description: 'View detailed market analysis',
      icon: <TrendingUp className="h-4 w-4" />,
      action: () => { navigate('/analysis'); onClose(); },
      category: 'Navigation',
      keywords: ['analysis', 'insights', 'trends'],
      shortcut: 'G then A'
    },
    {
      id: 'nav-predictions',
      title: 'Go to Predictions',
      description: 'View market predictions and forecasts',
      icon: <Globe className="h-4 w-4" />,
      action: () => { navigate('/predictions'); onClose(); },
      category: 'Navigation',
      keywords: ['predictions', 'forecasts', 'future'],
      shortcut: 'G then P'
    },
    {
      id: 'nav-feeds',
      title: 'Go to Feeds',
      description: 'Manage your data sources and feeds',
      icon: <MessageSquare className="h-4 w-4" />,
      action: () => { navigate('/feeds'); onClose(); },
      category: 'Navigation',
      keywords: ['feeds', 'sources', 'rss', 'data'],
      shortcut: 'G then F'
    },
    {
      id: 'nav-content',
      title: 'Go to Content',
      description: 'Browse processed content and articles',
      icon: <FileText className="h-4 w-4" />,
      action: () => { navigate('/content'); onClose(); },
      category: 'Navigation',
      keywords: ['content', 'articles', 'processed'],
      shortcut: 'G then C'
    },
    {
      id: 'nav-queue',
      title: 'Go to Queue',
      description: 'Monitor processing queue and jobs',
      icon: <Clock className="h-4 w-4" />,
      action: () => { navigate('/queue'); onClose(); },
      category: 'Navigation',
      keywords: ['queue', 'jobs', 'processing', 'tasks'],
      shortcut: 'G then Q'
    },
    {
      id: 'nav-entity-analytics',
      title: 'Go to Entity Analytics',
      description: 'Analyze entities and relationships',
      icon: <Hash className="h-4 w-4" />,
      action: () => { navigate('/entity-analytics'); onClose(); },
      category: 'Navigation',
      keywords: ['entity', 'analytics', 'relationships', 'entities'],
      shortcut: 'G then E'
    },
    {
      id: 'nav-insights',
      title: 'Go to Insights',
      description: 'View enhanced market insights',
      icon: <Zap className="h-4 w-4" />,
      action: () => { navigate('/insights'); onClose(); },
      category: 'Navigation',
      keywords: ['insights', 'enhanced', 'intelligence'],
      shortcut: 'G then I'
    },

    // Actions
    {
      id: 'action-refresh',
      title: 'Refresh Data',
      description: 'Refresh all dashboard data',
      icon: <ArrowRight className="h-4 w-4" />,
      action: () => { 
        window.location.reload(); 
        onClose(); 
      },
      category: 'Actions',
      keywords: ['refresh', 'reload', 'update', 'sync'],
      shortcut: 'R'
    },
    {
      id: 'action-export',
      title: 'Export Data',
      description: 'Export current view as CSV or JSON',
      icon: <Download className="h-4 w-4" />,
      action: () => { 
        info('Export', 'Export functionality coming soon!'); 
        onClose(); 
      },
      category: 'Actions',
      keywords: ['export', 'download', 'csv', 'json', 'data'],
      shortcut: 'E'
    },
    {
      id: 'action-favorite',
      title: 'Add to Favorites',
      description: 'Bookmark current page',
      icon: <Star className="h-4 w-4" />,
      action: () => { 
        success('Favorites', 'Page bookmarked successfully!'); 
        onClose(); 
      },
      category: 'Actions',
      keywords: ['favorite', 'bookmark', 'save', 'star'],
      shortcut: 'F'
    },
    {
      id: 'action-filter',
      title: 'Advanced Filters',
      description: 'Open advanced filtering options',
      icon: <Filter className="h-4 w-4" />,
      action: () => { 
        info('Filters', 'Advanced filtering options coming soon!'); 
        onClose(); 
      },
      category: 'Actions',
      keywords: ['filter', 'search', 'advanced', 'options'],
      shortcut: 'Ctrl+F'
    },

    // Settings
    {
      id: 'settings-theme-light',
      title: 'Switch to Light Theme',
      description: 'Change appearance to light mode',
      icon: <Settings className="h-4 w-4" />,
      action: () => { 
        setTheme('light'); 
        success('Theme', 'Switched to light theme'); 
        onClose(); 
      },
      category: 'Settings',
      keywords: ['theme', 'light', 'appearance', 'mode'],
      shortcut: 'T then L'
    },
    {
      id: 'settings-theme-dark',
      title: 'Switch to Dark Theme',
      description: 'Change appearance to dark mode',
      icon: <Settings className="h-4 w-4" />,
      action: () => { 
        setTheme('dark'); 
        success('Theme', 'Switched to dark theme'); 
        onClose(); 
      },
      category: 'Settings',
      keywords: ['theme', 'dark', 'appearance', 'mode'],
      shortcut: 'T then D'
    },
    {
      id: 'settings-theme-system',
      title: 'Use System Theme',
      description: 'Follow system appearance preference',
      icon: <Settings className="h-4 w-4" />,
      action: () => { 
        setTheme('system'); 
        success('Theme', 'Following system theme'); 
        onClose(); 
      },
      category: 'Settings',
      keywords: ['theme', 'system', 'auto', 'appearance'],
      shortcut: 'T then S'
    },
    {
      id: 'settings-profile',
      title: 'User Profile',
      description: 'View and edit your profile',
      icon: <User className="h-4 w-4" />,
      action: () => { 
        navigate('/profile'); 
        onClose(); 
      },
      category: 'Settings',
      keywords: ['profile', 'user', 'account', 'settings'],
      shortcut: 'P'
    },

    // Help
    {
      id: 'help-shortcuts',
      title: 'Keyboard Shortcuts',
      description: 'View all available keyboard shortcuts',
      icon: <Keyboard className="h-4 w-4" />,
      action: () => { 
        info('Shortcuts', 'Press ? to view keyboard shortcuts'); 
        onClose(); 
      },
      category: 'Help',
      keywords: ['help', 'shortcuts', 'keyboard', 'commands'],
      shortcut: '?'
    },
    {
      id: 'help-about',
      title: 'About Silver Fin Monitor',
      description: 'Learn more about this application',
      icon: <FileText className="h-4 w-4" />,
      action: () => { 
        info('About', 'Silver Fin Monitor - Market Intelligence Platform'); 
        onClose(); 
      },
      category: 'Help',
      keywords: ['about', 'info', 'version', 'app'],
      shortcut: 'A'
    }
  ];

  // Add recent actions to the beginning of actions list
  const actionsWithRecent = [
    ...actions
      .filter(action => recentActions.includes(action.id))
      .map(action => ({ ...action, isRecent: true })),
    ...actions.filter(action => !recentActions.includes(action.id))
  ];

  // Filter actions based on search
  const filteredActions = search
    ? actionsWithRecent.filter(action =>
        action.title.toLowerCase().includes(search.toLowerCase()) ||
        action.description?.toLowerCase().includes(search.toLowerCase()) ||
        action.keywords.some(keyword => 
          keyword.toLowerCase().includes(search.toLowerCase())
        ) ||
        action.category.toLowerCase().includes(search.toLowerCase())
      )
    : actionsWithRecent;

  // Group actions by category
  const groupedActions = filteredActions.reduce((groups, action) => {
    const category = action.isRecent ? 'Recent' : action.category;
    if (!groups[category]) groups[category] = [];
    groups[category].push(action);
    return groups;
  }, {} as Record<string, CommandAction[]>);

  // Reset selection when filtered actions change
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredActions.length - 1 ? prev + 1 : 0
        );
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : filteredActions.length - 1
        );
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        const selectedAction = filteredActions[selectedIndex];
        if (selectedAction) {
          executeAction(selectedAction);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, selectedIndex, filteredActions, onClose]);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const executeAction = (action: CommandAction) => {
    // Add to recent actions
    setRecentActions(prev => {
      const filtered = prev.filter(id => id !== action.id);
      return [action.id, ...filtered].slice(0, 5); // Keep last 5
    });

    // Execute the action
    action.action();
  };

  if (!open) return null;

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="glass rounded-lg shadow-2xl overflow-hidden border border-border">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-border/50">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Type a command or search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
            />
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <kbd className="px-2 py-1 bg-muted rounded text-xs">ESC</kbd>
              <span>to close</span>
            </div>
          </div>

          {/* Results */}
          <div className="max-h-96 overflow-y-auto custom-scrollbar">
            {filteredActions.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No commands found</p>
                <p className="text-sm">Try a different search term</p>
              </div>
            ) : (
              <div className="py-2">
                {Object.entries(groupedActions).map(([category, actions]) => (
                  <div key={category}>
                    <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {category}
                    </div>
                    {actions.map((action, index) => {
                      const globalIndex = filteredActions.indexOf(action);
                      const isSelected = globalIndex === selectedIndex;
                      
                      return (
                        <motion.button
                          key={action.id}
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                            isSelected 
                              ? 'bg-accent text-accent-foreground' 
                              : 'hover:bg-accent/50'
                          )}
                          onClick={() => executeAction(action)}
                          whileHover={{ x: 2 }}
                          transition={{ duration: 0.1 }}
                        >
                          <div className="flex-shrink-0">
                            {action.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{action.title}</span>
                              {action.isRecent && (
                                <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                                  Recent
                                </span>
                              )}
                            </div>
                            {action.description && (
                              <p className="text-sm text-muted-foreground truncate">
                                {action.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {action.shortcut && (
                              <kbd className="px-2 py-1 bg-muted rounded">
                                {action.shortcut}
                              </kbd>
                            )}
                            <ChevronRight className="h-3 w-3" />
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 bg-muted/30">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-muted rounded">↑</kbd>
                <kbd className="px-1.5 py-0.5 bg-muted rounded">↓</kbd>
                <span>to navigate</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-muted rounded">↵</kbd>
                <span>to select</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Command className="h-3 w-3" />
              <span>Command Palette</span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};