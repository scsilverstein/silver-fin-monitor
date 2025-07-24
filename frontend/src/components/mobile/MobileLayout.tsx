// Mobile-Specific Responsive Layout System
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  X,
  Search,
  Settings,
  Bell,
  Home,
  BarChart,
  TrendingUp,
  Globe,
  MessageSquare,
  FileText,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTouchGestures, deviceUtils } from '@/lib/touchOptimizations';

interface MobileLayoutProps {
  children: React.ReactNode;
  showBottomNav?: boolean;
  showHeader?: boolean;
  headerTitle?: string;
  headerActions?: React.ReactNode;
  showSearchBar?: boolean;
  swipeEnabled?: boolean;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  badge?: number;
}

const bottomNavItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <Home className="h-5 w-5" />,
    path: '/dashboard',
  },
  {
    id: 'analysis',
    label: 'Analysis',
    icon: <BarChart className="h-5 w-5" />,
    path: '/analysis',
  },
  {
    id: 'predictions',
    label: 'Predictions',
    icon: <TrendingUp className="h-5 w-5" />,
    path: '/predictions',
  },
  {
    id: 'feeds',
    label: 'Feeds',
    icon: <MessageSquare className="h-5 w-5" />,
    path: '/feeds',
  },
  {
    id: 'more',
    label: 'More',
    icon: <MoreHorizontal className="h-5 w-5" />,
    path: '/more',
  },
];

export const MobileLayout: React.FC<MobileLayoutProps> = ({
  children,
  showBottomNav = true,
  showHeader = true,
  headerTitle,
  headerActions,
  showSearchBar = false,
  swipeEnabled = true,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  
  const location = useLocation();
  const navigate = useNavigate();

  // Find current page index for swipe navigation
  useEffect(() => {
    const index = bottomNavItems.findIndex(item => item.path === location.pathname);
    if (index !== -1) {
      setCurrentPageIndex(index);
    }
  }, [location.pathname]);

  // Swipe navigation
  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    if (!swipeEnabled) return;

    let newIndex = currentPageIndex;
    if (direction === 'left' && currentPageIndex < bottomNavItems.length - 1) {
      newIndex = currentPageIndex + 1;
    } else if (direction === 'right' && currentPageIndex > 0) {
      newIndex = currentPageIndex - 1;
    }

    if (newIndex !== currentPageIndex) {
      navigate(bottomNavItems[newIndex].path);
    }
  }, [currentPageIndex, navigate, swipeEnabled]);

  const swipeRef = useTouchGestures({
    onSwipe: (gesture) => {
      if (gesture.direction === 'left' || gesture.direction === 'right') {
        handleSwipe(gesture.direction);
      }
    },
  }, {
    swipeThreshold: 100,
    swipeVelocityThreshold: 0.3,
  });

  // Get active nav item
  const activeNavItem = bottomNavItems.find(item => 
    location.pathname.startsWith(item.path)
  )?.id || 'dashboard';

  // Handle navigation
  const handleNavigation = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
  };

  // Close overlays when clicking outside
  const closeOverlays = () => {
    setSidebarOpen(false);
    setSearchOpen(false);
    setNotificationsOpen(false);
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Mobile Header */}
      {showHeader && (
        <header className="flex-shrink-0 bg-background border-b border-border px-4 py-3 safe-area-top">
          <div className="flex items-center justify-between">
            {/* Left Section */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 hover:bg-accent rounded-lg transition-colors touch-target"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              
              {headerTitle && (
                <h1 className="text-lg font-semibold text-foreground truncate">
                  {headerTitle}
                </h1>
              )}
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-2">
              {showSearchBar && (
                <button
                  onClick={() => setSearchOpen(true)}
                  className="p-2 hover:bg-accent rounded-lg transition-colors touch-target"
                  aria-label="Search"
                >
                  <Search className="h-5 w-5" />
                </button>
              )}
              
              <button
                onClick={() => setNotificationsOpen(true)}
                className="relative p-2 hover:bg-accent rounded-lg transition-colors touch-target"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full" />
              </button>

              {headerActions}
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main 
        ref={swipeRef}
        className="flex-1 overflow-hidden relative"
        onClick={closeOverlays}
      >
        <div className="h-full overflow-y-auto custom-scrollbar">
          <div className="min-h-full safe-area-bottom pb-20">
            {children}
          </div>
        </div>

        {/* Page Indicators */}
        {swipeEnabled && (
          <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 flex gap-2 bg-background/80 backdrop-blur-sm rounded-full px-3 py-2">
            {bottomNavItems.slice(0, -1).map((_, index) => (
              <div
                key={index}
                className={cn(
                  'w-2 h-2 rounded-full transition-colors',
                  index === currentPageIndex ? 'bg-primary' : 'bg-muted'
                )}
              />
            ))}
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      {showBottomNav && (
        <nav className="flex-shrink-0 bg-background border-t border-border safe-area-bottom">
          <div className="flex justify-around items-center px-2 py-2">
            {bottomNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.path)}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors touch-target',
                  'min-w-[64px] min-h-[56px]',
                  activeNavItem === item.id
                    ? 'text-primary bg-primary/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
                aria-label={item.label}
              >
                <div className="relative">
                  {item.icon}
                  {item.badge && (
                    <div className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {item.badge > 99 ? '99+' : item.badge}
                    </div>
                  )}
                </div>
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}

      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
            />
            
            <motion.aside
              className="fixed left-0 top-0 bottom-0 w-80 bg-background border-r border-border z-50 overflow-y-auto"
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            >
              <div className="p-4">
                {/* Sidebar Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">Silver Fin Monitor</h2>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="p-2 hover:bg-accent rounded-lg transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* User Profile */}
                <div className="flex items-center gap-3 p-3 bg-accent/50 rounded-lg mb-6">
                  <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                    <User className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">John Doe</p>
                    <p className="text-sm text-muted-foreground">Premium User</p>
                  </div>
                </div>

                {/* Navigation Menu */}
                <nav className="space-y-2">
                  {[
                    { label: 'Dashboard', icon: <Home className="h-5 w-5" />, path: '/dashboard' },
                    { label: 'Analysis', icon: <BarChart className="h-5 w-5" />, path: '/analysis' },
                    { label: 'Predictions', icon: <TrendingUp className="h-5 w-5" />, path: '/predictions' },
                    { label: 'Entity Analytics', icon: <Globe className="h-5 w-5" />, path: '/entity-analytics' },
                    { label: 'Feeds', icon: <MessageSquare className="h-5 w-5" />, path: '/feeds' },
                    { label: 'Content', icon: <FileText className="h-5 w-5" />, path: '/content' },
                    { label: 'Settings', icon: <Settings className="h-5 w-5" />, path: '/settings' },
                  ].map((item) => (
                    <button
                      key={item.path}
                      onClick={() => handleNavigation(item.path)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors text-left',
                        location.pathname.startsWith(item.path)
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-accent text-foreground'
                      )}
                    >
                      {item.icon}
                      <span className="font-medium">{item.label}</span>
                    </button>
                  ))}
                </nav>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Search Overlay */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            className="fixed inset-0 bg-background z-50 flex flex-col"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <div className="flex-shrink-0 p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSearchOpen(false)}
                  className="p-2 hover:bg-accent rounded-lg"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search everything..."
                    className="w-full px-4 py-3 bg-accent rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                  />
                </div>
              </div>
            </div>
            
            <div className="flex-1 p-4">
              <div className="text-center text-muted-foreground mt-8">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Start typing to search</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notifications Overlay */}
      <AnimatePresence>
        {notificationsOpen && (
          <motion.div
            className="fixed inset-0 bg-background z-50 flex flex-col"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <div className="flex-shrink-0 p-4 border-b border-border">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setNotificationsOpen(false)}
                  className="p-2 hover:bg-accent rounded-lg"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                
                <h2 className="text-lg font-semibold">Notifications</h2>
                
                <button className="p-2 hover:bg-accent rounded-lg">
                  <Settings className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-4 bg-accent/50 rounded-lg">
                    <div className="flex gap-3">
                      <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium">Market Alert</p>
                        <p className="text-sm text-muted-foreground">
                          Significant movement detected in tech stocks
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">2 hours ago</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Hook for mobile layout management
export const useMobileLayout = () => {
  const [isMobile, setIsMobile] = useState(deviceUtils.isMobile());
  const [isTablet, setIsTablet] = useState(deviceUtils.isTablet());
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [safeArea, setSafeArea] = useState({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  });

  useEffect(() => {
    const updateLayout = () => {
      setIsMobile(deviceUtils.isMobile());
      setIsTablet(deviceUtils.isTablet());
      setOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
      
      // Update safe area
      if (CSS.supports('env(safe-area-inset-top)')) {
        const computedStyle = getComputedStyle(document.documentElement);
        setSafeArea({
          top: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-top)')) || 0,
          bottom: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-bottom)')) || 0,
          left: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-left)')) || 0,
          right: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-right)')) || 0,
        });
      }
    };

    updateLayout();
    window.addEventListener('resize', updateLayout);
    window.addEventListener('orientationchange', updateLayout);

    return () => {
      window.removeEventListener('resize', updateLayout);
      window.removeEventListener('orientationchange', updateLayout);
    };
  }, []);

  return {
    isMobile,
    isTablet,
    orientation,
    safeArea,
    isLandscape: orientation === 'landscape',
    isPortrait: orientation === 'portrait',
  };
};

// Mobile-optimized card component
export const MobileCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
  touchFeedback?: boolean;
  onClick?: () => void;
}> = ({ children, className, padding = 'md', touchFeedback = true, onClick }) => {
  const paddingClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  const touchRef = useTouchGestures({
    onTap: onClick || (() => {}),
  });

  return (
    <div
      ref={onClick ? touchRef : undefined}
      className={cn(
        'bg-card border border-border rounded-lg shadow-sm',
        paddingClasses[padding],
        touchFeedback && onClick && 'active:scale-[0.98] transition-transform',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  );
};

// Mobile-optimized grid
export const MobileGrid: React.FC<{
  children: React.ReactNode;
  columns?: 1 | 2 | 3;
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ children, columns = 2, gap = 'md', className }) => {
  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
  };

  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
  };

  return (
    <div className={cn(
      'grid',
      columnClasses[columns],
      gapClasses[gap],
      className
    )}>
      {children}
    </div>
  );
};

export default MobileLayout;