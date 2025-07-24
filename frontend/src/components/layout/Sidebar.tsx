import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Rss, 
  TrendingUp, 
  Brain, 
  Target,
  Settings,
  BarChart3,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store';

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/',
    icon: LayoutDashboard
  },
  {
    title: 'Feed Sources',
    href: '/feeds',
    icon: Rss
  },
  {
    title: 'Market Analysis',
    href: '/analysis',
    icon: TrendingUp
  },
  {
    title: 'Predictions',
    href: '/predictions',
    icon: Brain
  },
  {
    title: 'Accuracy',
    href: '/accuracy',
    icon: Target
  },
  {
    title: 'Activity',
    href: '/activity',
    icon: Activity
  },
  {
    title: 'Reports',
    href: '/reports',
    icon: BarChart3
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings
  }
];

export const Sidebar: React.FC = () => {
  const { sidebarOpen } = useAppStore();

  return (
    <aside
      className={cn(
        'fixed left-0 z-40 h-full w-64 transform border-r bg-background transition-transform duration-300 ease-in-out',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        'md:translate-x-0'
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-1 px-3">
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-accent',
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )
                }
              >
                <item.icon className="h-5 w-5" />
                {item.title}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="border-t p-4">
          <div className="rounded-lg bg-muted p-3">
            <h3 className="text-sm font-medium">System Status</h3>
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span>Queue</span>
                <span className="text-green-600">Active</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span>AI Service</span>
                <span className="text-green-600">Connected</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};