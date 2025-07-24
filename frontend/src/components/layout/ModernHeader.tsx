import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Search,
  Bell,
  User,
  Settings,
  LogOut,
  ChevronDown,
  Command,
  Sparkles,
  Keyboard
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useToast } from '@/contexts/ToastContext';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { PWAStatus } from '@/components/ui/PWAStatus';

interface Notification {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
  type: 'info' | 'success' | 'warning' | 'error';
}

const mockNotifications: Notification[] = [
  {
    id: '1',
    title: 'New Market Analysis',
    description: 'Daily analysis for tech sector completed',
    time: '5m ago',
    read: false,
    type: 'info',
  },
  {
    id: '2',
    title: 'Prediction Accuracy Update',
    description: 'Your prediction accuracy improved to 82%',
    time: '1h ago',
    read: false,
    type: 'success',
  },
  {
    id: '3',
    title: 'Feed Processing Complete',
    description: '15 new articles processed from RSS feeds',
    time: '2h ago',
    read: true,
    type: 'info',
  },
];

export const ModernHeader: React.FC = () => {
  const navigate = useNavigate();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { setShowHelp } = useKeyboardShortcuts();
  const { success } = useToast();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const unreadCount = mockNotifications.filter(n => !n.read).length;

  return (
    <header className="sticky top-0 z-30 bg-background/50 backdrop-blur-xl border-b border-border/50">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left Section - Search */}
          <div className="flex-1 flex items-center max-w-md">
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search anything..."
                data-search-input
                className={cn(
                  'w-full pl-10 pr-4 py-2 text-sm',
                  'bg-muted/50 border border-transparent rounded-lg',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
                  'placeholder:text-muted-foreground',
                  'transition-all duration-200'
                )}
                onKeyDown={(e) => {
                  if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    setCommandPaletteOpen(true);
                  }
                }}
                onFocus={() => setCommandPaletteOpen(true)}
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-muted rounded">
                  <Command className="h-3 w-3" />K
                </kbd>
              </div>
            </div>
          </div>

          {/* Right Section - Actions */}
          <div className="flex items-center gap-2 ml-4">
            {/* AI Assistant */}
            <button 
              onClick={() => success('AI Assistant', 'AI features coming soon!')}
              className={cn(
                'p-2 rounded-lg transition-colors',
                'hover:bg-accent/50 text-muted-foreground hover:text-foreground',
                'hidden sm:inline-flex'
              )}
            >
              <Sparkles className="h-5 w-5" />
            </button>

            {/* Keyboard Shortcuts */}
            <button
              onClick={() => setShowHelp(true)}
              className={cn(
                'p-2 rounded-lg transition-colors',
                'hover:bg-accent/50 text-muted-foreground hover:text-foreground',
                'hidden sm:inline-flex'
              )}
              title="Keyboard shortcuts (?)"
            >
              <Keyboard className="h-5 w-5" />
            </button>

            {/* PWA Status */}
            <PWAStatus />

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className={cn(
                  'p-2 rounded-lg transition-colors relative',
                  'hover:bg-accent/50 text-muted-foreground hover:text-foreground'
                )}
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
                )}
              </button>

              {/* Notifications Dropdown */}
              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 glass rounded-lg shadow-lg overflow-hidden animate-in slide-in-down">
                  <div className="p-4 border-b border-border/50">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Notifications</h3>
                      {unreadCount > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {unreadCount} unread
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {mockNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={cn(
                          'p-4 border-b border-border/50 hover:bg-accent/50 transition-colors cursor-pointer',
                          !notification.read && 'bg-primary/5'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                            notification.type === 'info' && 'bg-info',
                            notification.type === 'success' && 'bg-success',
                            notification.type === 'warning' && 'bg-warning',
                            notification.type === 'error' && 'bg-error'
                          )} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{notification.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {notification.description}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {notification.time}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 text-center border-t border-border/50">
                    <button className="text-sm text-primary hover:underline">
                      View all notifications
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className={cn(
                  'flex items-center gap-2 p-2 rounded-lg transition-colors',
                  'hover:bg-accent/50'
                )}
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                  <User className="h-4 w-4 text-white" />
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>

              {/* Profile Menu */}
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 glass rounded-lg shadow-lg overflow-hidden animate-in slide-in-down">
                  <div className="p-4 border-b border-border/50">
                    <p className="text-sm font-medium">John Doe</p>
                    <p className="text-xs text-muted-foreground">admin@silverfin.com</p>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={() => navigate('/profile')}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg',
                        'hover:bg-accent/50 transition-colors text-left'
                      )}
                    >
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Profile</span>
                    </button>
                    <button
                      onClick={() => navigate('/settings')}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg',
                        'hover:bg-accent/50 transition-colors text-left'
                      )}
                    >
                      <Settings className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Settings</span>
                    </button>
                    <div className="my-2 border-t border-border/50" />
                    <button
                      onClick={handleLogout}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg',
                        'hover:bg-destructive/10 hover:text-destructive transition-colors text-left'
                      )}
                    >
                      <LogOut className="h-4 w-4" />
                      <span className="text-sm">Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Command Palette */}
      <CommandPalette 
        open={commandPaletteOpen} 
        onClose={() => setCommandPaletteOpen(false)} 
      />
    </header>
  );
};