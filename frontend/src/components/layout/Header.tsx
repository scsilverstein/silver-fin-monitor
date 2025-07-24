import React from 'react';
import { Menu, Bell, User, LogOut, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui';
import { useAuthStore, useAppStore } from '@/store';
import { useNavigate } from 'react-router-dom';

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();
  const { toggleSidebar, theme, toggleTheme } = useAppStore();

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="mr-4 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex flex-1 items-center justify-between">
          <h1 className="text-xl font-bold">Silver Fin Monitor</h1>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
            >
              {theme === 'light' ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
            </Button>

            <Button variant="ghost" size="icon">
              <Bell className="h-5 w-5" />
            </Button>

            <div className="flex items-center gap-2 ml-2">
              <div className="hidden md:block text-right">
                <p className="text-sm font-medium">{user?.email}</p>
                <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/settings')}
              >
                <User className="h-5 w-5" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};