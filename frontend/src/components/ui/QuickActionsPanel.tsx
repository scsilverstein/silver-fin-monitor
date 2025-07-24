import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Plus,
  RefreshCw,
  Download,
  Upload,
  Settings,
  Filter,
  Search,
  Star,
  Share,
  Calendar,
  TrendingUp,
  BarChart,
  FileText,
  Bell,
  Mail,
  ExternalLink,
  ChevronRight,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/contexts/ToastContext';

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
  category: 'create' | 'analyze' | 'manage' | 'export' | 'view';
  shortcut?: string;
  badge?: string;
  disabled?: boolean;
}

interface QuickActionsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

export const QuickActionsPanel: React.FC<QuickActionsPanelProps> = ({
  isOpen,
  onClose,
  position = 'bottom-right'
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const navigate = useNavigate();
  const { success, info } = useToast();

  const quickActions: QuickAction[] = [
    // Create Actions
    {
      id: 'create-feed',
      title: 'Add New Feed',
      description: 'Add a new RSS feed or data source',
      icon: <Plus className="h-4 w-4" />,
      action: () => {
        navigate('/feeds');
        info('Navigation', 'Navigate to feeds page to add a new source');
        onClose();
      },
      category: 'create',
      shortcut: 'Ctrl+N',
    },
    {
      id: 'create-analysis',
      title: 'Generate Analysis',
      description: 'Create custom market analysis',
      icon: <TrendingUp className="h-4 w-4" />,
      action: () => {
        navigate('/analysis');
        info('Analysis', 'Custom analysis generation coming soon!');
        onClose();
      },
      category: 'create',
      badge: 'Soon',
    },
    {
      id: 'create-prediction',
      title: 'Make Prediction',
      description: 'Create a new market prediction',
      icon: <Star className="h-4 w-4" />,
      action: () => {
        navigate('/predictions');
        info('Predictions', 'Custom prediction creation coming soon!');
        onClose();
      },
      category: 'create',
      badge: 'Soon',
    },

    // Analyze Actions
    {
      id: 'analyze-sentiment',
      title: 'Sentiment Analysis',
      description: 'Analyze current market sentiment',
      icon: <BarChart className="h-4 w-4" />,
      action: () => {
        navigate('/dashboard');
        success('Analysis', 'Viewing current sentiment analysis');
        onClose();
      },
      category: 'analyze',
    },
    {
      id: 'analyze-trends',
      title: 'Trend Analysis',
      description: 'Identify emerging market trends',
      icon: <TrendingUp className="h-4 w-4" />,
      action: () => {
        navigate('/analysis');
        onClose();
      },
      category: 'analyze',
    },
    {
      id: 'analyze-entities',
      title: 'Entity Analytics',
      description: 'Analyze entity relationships',
      icon: <Search className="h-4 w-4" />,
      action: () => {
        navigate('/entity-analytics');
        onClose();
      },
      category: 'analyze',
    },

    // Manage Actions
    {
      id: 'manage-feeds',
      title: 'Manage Feeds',
      description: 'Configure data sources and feeds',
      icon: <Settings className="h-4 w-4" />,
      action: () => {
        navigate('/feeds');
        onClose();
      },
      category: 'manage',
    },
    {
      id: 'manage-queue',
      title: 'Processing Queue',
      description: 'Monitor background processing',
      icon: <RefreshCw className="h-4 w-4" />,
      action: () => {
        navigate('/queue');
        onClose();
      },
      category: 'manage',
    },
    {
      id: 'manage-notifications',
      title: 'Notifications',
      description: 'Configure alerts and notifications',
      icon: <Bell className="h-4 w-4" />,
      action: () => {
        info('Notifications', 'Notification settings coming soon!');
        onClose();
      },
      category: 'manage',
      badge: 'Soon',
    },

    // Export Actions
    {
      id: 'export-data',
      title: 'Export Data',
      description: 'Download data as CSV or JSON',
      icon: <Download className="h-4 w-4" />,
      action: () => {
        info('Export', 'Data export functionality coming soon!');
        onClose();
      },
      category: 'export',
      badge: 'Soon',
    },
    {
      id: 'export-report',
      title: 'Generate Report',
      description: 'Create PDF report of insights',
      icon: <FileText className="h-4 w-4" />,
      action: () => {
        info('Reports', 'Report generation coming soon!');
        onClose();
      },
      category: 'export',
      badge: 'Soon',
    },
    {
      id: 'share-insights',
      title: 'Share Insights',
      description: 'Share analysis via email or link',
      icon: <Share className="h-4 w-4" />,
      action: () => {
        info('Sharing', 'Sharing functionality coming soon!');
        onClose();
      },
      category: 'export',
      badge: 'Soon',
    },

    // View Actions
    {
      id: 'view-calendar',
      title: 'Economic Calendar',
      description: 'View upcoming economic events',
      icon: <Calendar className="h-4 w-4" />,
      action: () => {
        info('Calendar', 'Economic calendar coming soon!');
        onClose();
      },
      category: 'view',
      badge: 'Soon',
    },
    {
      id: 'view-processed',
      title: 'Processed Content',
      description: 'Browse processed articles and content',
      icon: <FileText className="h-4 w-4" />,
      action: () => {
        navigate('/content');
        onClose();
      },
      category: 'view',
    },
  ];

  const categories = [
    { id: 'create', label: 'Create', icon: <Plus className="h-4 w-4" /> },
    { id: 'analyze', label: 'Analyze', icon: <TrendingUp className="h-4 w-4" /> },
    { id: 'manage', label: 'Manage', icon: <Settings className="h-4 w-4" /> },
    { id: 'export', label: 'Export', icon: <Download className="h-4 w-4" /> },
    { id: 'view', label: 'View', icon: <Search className="h-4 w-4" /> },
  ];

  const filteredActions = selectedCategory
    ? quickActions.filter(action => action.category === selectedCategory)
    : quickActions;

  const getPositionClasses = () => {
    switch (position) {
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'top-right':
        return 'top-4 right-4';
      case 'top-left':
        return 'top-4 left-4';
      default:
        return 'bottom-4 right-4';
    }
  };

  const getAnimationOrigin = () => {
    switch (position) {
      case 'bottom-right':
        return { originX: 1, originY: 1 };
      case 'bottom-left':
        return { originX: 0, originY: 1 };
      case 'top-right':
        return { originX: 1, originY: 0 };
      case 'top-left':
        return { originX: 0, originY: 0 };
      default:
        return { originX: 1, originY: 1 };
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className={cn('fixed z-50', getPositionClasses())}
            initial={{ opacity: 0, scale: 0.8, ...getAnimationOrigin() }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, ...getAnimationOrigin() }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
          >
            <div className="glass rounded-lg border border-border/50 shadow-2xl w-80 max-h-96 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Quick Actions</h3>
                </div>
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-accent rounded transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Categories */}
              <div className="p-2 border-b border-border/50">
                <div className="flex gap-1">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={cn(
                      'px-3 py-1.5 text-xs rounded-full transition-colors',
                      !selectedCategory
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-accent text-muted-foreground'
                    )}
                  >
                    All
                  </button>
                  {categories.map(category => (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={cn(
                        'flex items-center gap-1 px-3 py-1.5 text-xs rounded-full transition-colors',
                        selectedCategory === category.id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-accent text-muted-foreground'
                      )}
                    >
                      {category.icon}
                      {category.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="max-h-64 overflow-y-auto custom-scrollbar">
                <div className="p-2 space-y-1">
                  {filteredActions.map((action, index) => (
                    <motion.button
                      key={action.id}
                      onClick={action.action}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors',
                        'hover:bg-accent/50',
                        action.disabled && 'opacity-50 cursor-not-allowed'
                      )}
                      disabled={action.disabled}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex-shrink-0 text-muted-foreground">
                        {action.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{action.title}</span>
                          {action.badge && (
                            <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                              {action.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {action.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {action.shortcut && (
                          <kbd className="px-1.5 py-0.5 bg-muted rounded">
                            {action.shortcut}
                          </kbd>
                        )}
                        <ChevronRight className="h-3 w-3" />
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="p-3 bg-muted/20 border-t border-border/50 text-center">
                <p className="text-xs text-muted-foreground">
                  Press <kbd className="px-1 py-0.5 bg-muted rounded text-xs">ESC</kbd> to close
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// Quick Actions Button Component
export const QuickActionsButton: React.FC<{
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}> = ({ position = 'bottom-right' }) => {
  const [isOpen, setIsOpen] = useState(false);

  const getButtonPositionClasses = () => {
    switch (position) {
      case 'bottom-right':
        return 'bottom-6 right-6';
      case 'bottom-left':
        return 'bottom-6 left-6';
      case 'top-right':
        return 'top-6 right-6';
      case 'top-left':
        return 'top-6 left-6';
      default:
        return 'bottom-6 right-6';
    }
  };

  return (
    <>
      <motion.button
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed z-40 p-4 bg-primary text-primary-foreground rounded-full shadow-lg',
          'hover:bg-primary/90 transition-colors',
          getButtonPositionClasses()
        )}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1, type: "spring", damping: 20, stiffness: 300 }}
      >
        <Zap className="h-6 w-6" />
      </motion.button>

      <QuickActionsPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        position={position}
      />
    </>
  );
};