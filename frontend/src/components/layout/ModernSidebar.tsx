import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Rss,
  TrendingUp,
  BarChart3,
  Settings,
  HelpCircle,
  LogOut,
  Menu,
  X,
  Brain,
  Globe,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Activity,
  FileText,
  DollarSign,
  Users,
  Shield,
  Target,
  Lightbulb,
  Map,
  Zap,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string | number;
  children?: NavItem[];
}

const navigation: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Feeds',
    href: '/feeds',
    icon: Rss,
    badge: 'New',
  },
  {
    label: 'Content',
    href: '/content',
    icon: FileText,
  },
  {
    label: 'Analysis',
    href: '/analysis',
    icon: Brain,
    children: [
      {
        label: 'Market Analysis',
        href: '/analysis',
        icon: Brain,
      },
      {
        label: 'Analysis Overlay',
        href: '/analysis/overlay',
        icon: TrendingUp,
        badge: 'New',
      },
      {
        label: 'Timeframe Analysis',
        href: '/analysis/timeframe',
        icon: Calendar,
      },
    ],
  },
  {
    label: 'Predictions',
    href: '/predictions',
    icon: Target,
  },
  {
    label: 'Entities',
    href: '/entities',
    icon: Users,
  },
  {
    label: 'Earnings Calendar',
    href: '/earnings',
    icon: Calendar,
    badge: 'New',
  },
  {
    label: 'Stock Screener',
    href: '/stocks/screener',
    icon: DollarSign,
    badge: 'New',
  },
  {
    label: 'Market Map',
    href: '/market-map',
    icon: Map,
    badge: 'New',
  },
  {
    label: 'Insights',
    href: '/insights',
    icon: BarChart3,
  },
  {
    label: 'Intelligence',
    href: '/intelligence',
    icon: Lightbulb,
    badge: 'New',
  },
  {
    label: 'Queue',
    href: '/queue',
    icon: Activity,
  },
];

const bottomNavigation: NavItem[] = [
  {
    label: 'Process Control',
    href: '/process-control',
    icon: Zap,
    badge: 'New',
  },
  {
    label: 'Admin',
    href: '/admin',
    icon: Shield,
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
  },
  {
    label: 'Help',
    href: '/help',
    icon: HelpCircle,
  },
];

export const ModernSidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const toggleExpanded = (label: string) => {
    setExpandedItems(prev =>
      prev.includes(label)
        ? prev.filter(item => item !== label)
        : [...prev, label]
    );
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const isActive = (href: string) => {
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  const renderNavItem = (item: NavItem, isChild = false) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.label);
    const active = isActive(item.href);

    return (
      <div key={item.href} className="w-full">
        <Link
          to={!hasChildren ? item.href : '#'}
          onClick={(e) => {
            if (hasChildren) {
              e.preventDefault();
              toggleExpanded(item.label);
            }
          }}
          className={cn(
            'flex items-center w-full px-3 py-2.5 rounded-lg',
            'transition-all duration-200 group relative',
            'hover:bg-accent/50',
            active && !hasChildren && 'bg-primary/10 text-primary',
            isChild && 'pl-12',
            isCollapsed && !isChild && 'justify-center'
          )}
        >
          {/* Active Indicator */}
          {active && !hasChildren && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
          )}

          {/* Icon */}
          <item.icon className={cn(
            'flex-shrink-0 transition-colors',
            active ? 'text-primary' : 'text-muted-foreground',
            'group-hover:text-foreground',
            isCollapsed ? 'w-5 h-5' : 'w-5 h-5 mr-3'
          )} />

          {/* Label & Badge */}
          {!isCollapsed && (
            <>
              <span className={cn(
                'flex-1 text-sm font-medium',
                active ? 'text-primary' : 'text-muted-foreground',
                'group-hover:text-foreground'
              )}>
                {item.label}
              </span>

              {item.badge && (
                <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-primary/20 text-primary rounded-full">
                  {item.badge}
                </span>
              )}

              {hasChildren && (
                <ChevronRight className={cn(
                  'w-4 h-4 transition-transform',
                  isExpanded && 'rotate-90'
                )} />
              )}
            </>
          )}
        </Link>

        {/* Children Items */}
        {hasChildren && isExpanded && !isCollapsed && (
          <div className="mt-1 space-y-1">
            {item.children!.map(child => renderNavItem(child, true))}
          </div>
        )}
      </div>
    );
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="px-6 py-6 border-b border-border/50">
        <Link to="/dashboard" className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/60 rounded-lg flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="text-lg font-display font-semibold">Silver Fin</h1>
              <p className="text-xs text-muted-foreground">Market Intelligence</p>
            </div>
          )}
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
        {navigation.map(item => renderNavItem(item))}
      </nav>

      {/* Bottom Navigation */}
      <div className="border-t border-border/50 px-3 py-4 space-y-1">
        {bottomNavigation.map(item => renderNavItem(item))}
        
        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className={cn(
            'flex items-center w-full px-3 py-2.5 rounded-lg',
            'transition-all duration-200 group',
            'hover:bg-destructive/10 hover:text-destructive',
            'text-muted-foreground',
            isCollapsed && 'justify-center'
          )}
        >
          <LogOut className={cn(
            'flex-shrink-0',
            isCollapsed ? 'w-5 h-5' : 'w-5 h-5 mr-3'
          )} />
          {!isCollapsed && (
            <span className="flex-1 text-sm font-medium text-left">
              Logout
            </span>
          )}
        </button>
      </div>

      {/* Collapse Toggle */}
      <div className="border-t border-border/50 px-3 py-3">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            'flex items-center w-full px-3 py-2 rounded-lg',
            'transition-all duration-200',
            'hover:bg-accent/50',
            'text-muted-foreground hover:text-foreground',
            isCollapsed && 'justify-center'
          )}
        >
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5 mr-3" />
              <span className="text-sm font-medium">Collapse</span>
            </>
          )}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className={cn(
          'lg:hidden fixed top-4 left-4 z-50',
          'p-2 rounded-lg bg-background/80 backdrop-blur-sm',
          'border border-border shadow-sm',
          'hover:bg-accent transition-colors'
        )}
      >
        {isMobileOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <Menu className="w-5 h-5" />
        )}
      </button>

      {/* Desktop Sidebar */}
      <aside className={cn(
        'hidden lg:flex flex-col',
        'bg-background/50 backdrop-blur-xl',
        'border-r border-border/50',
        'transition-all duration-300 ease-in-out',
        isCollapsed ? 'w-20' : 'w-64',
        'h-screen sticky top-0'
      )}>
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar */}
      <div className={cn(
        'lg:hidden fixed inset-0 z-40 transition-opacity duration-300',
        isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      )}>
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          onClick={() => setIsMobileOpen(false)}
        />
        
        {/* Sidebar */}
        <aside className={cn(
          'absolute left-0 top-0 h-full w-64',
          'bg-background border-r border-border',
          'transform transition-transform duration-300',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full',
          'flex flex-col'
        )}>
          {sidebarContent}
        </aside>
      </div>
    </>
  );
};