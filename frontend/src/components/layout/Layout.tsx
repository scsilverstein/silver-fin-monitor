import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store';

export const Layout: React.FC = () => {
  const { sidebarOpen } = useAppStore();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar />
      <main
        className={cn(
          'min-h-[calc(100vh-4rem)] transition-all duration-300',
          sidebarOpen ? 'md:ml-64' : 'ml-0'
        )}
      >
        <div className="container py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};