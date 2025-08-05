import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { ComingSoonPage } from '@/components/common/ComingSoonPage';
import { ModernLayout } from '@/components/layout';
import { ModernLogin } from '@/pages/ModernLogin';
import { ModernDashboard } from '@/pages/ModernDashboard';
import { ModernFeeds } from '@/pages/ModernFeeds';
import { ModernContent } from '@/pages/ModernContent';
import { ModernAnalysis } from '@/pages/ModernAnalysis';
import { ModernInsights } from '@/pages/ModernInsights';
import { EnhancedInsights } from '@/pages/EnhancedInsights';
import { TestCSS } from '@/pages/TestCSS';
import { CSSDebug } from '@/pages/CSSDebug';
import QueueManagement from '@/pages/QueueManagement';
import TimeframeAnalysis from '@/pages/TimeframeAnalysis';
import Predictions from '@/pages/Predictions';
import { EntityAnalyticsPage } from '@/pages/EntityAnalytics';
import { Admin } from '@/pages/Admin';
import EarningsCalendarPage from '@/pages/EarningsCalendar';
import IntelligenceDashboard from '@/pages/IntelligenceDashboard';
import { AnalysisOverlay } from '@/pages/AnalysisOverlay';
import { StockScreener } from '@/pages/StockScreener';
import { AnalysisDetail } from '@/components/analysis/AnalysisDetail';
import { AnalysisList } from '@/pages/AnalysisList';
import { StockScannerPage } from '@/pages/StockScannerPage';
import { AdminDashboard } from '@/pages/AdminDashboard';
import QueueTest from '@/pages/QueueTest';
import QueueDebug from '@/pages/QueueDebug';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<ModernLogin />} />
      <Route path="/test-css" element={<TestCSS />} />
      <Route path="/css-debug" element={<CSSDebug />} />
      
      {/* Root redirect */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Navigate to="/dashboard" replace />
          </ProtectedRoute>
        }
      />
      
      {/* Protected routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <ModernLayout>
              <ModernDashboard />
            </ModernLayout>
          </ProtectedRoute>
        }
      />
      
      <Route 
        path="/feeds" 
        element={
          <ProtectedRoute>
            <ModernLayout>
              <ModernFeeds />
            </ModernLayout>
          </ProtectedRoute>
        } 
      />
      
      <Route
        path="/analysis"
        element={
          <ProtectedRoute>
            <ModernLayout>
              <ModernAnalysis />
            </ModernLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/analysis/timeframe"
        element={
          <ProtectedRoute>
            <ModernLayout>
              <TimeframeAnalysis />
            </ModernLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/analysis/overlay"
        element={
          <ProtectedRoute>
            <ModernLayout>
              <AnalysisOverlay />
            </ModernLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/analysis/list"
        element={
          <ProtectedRoute>
            <ModernLayout>
              <AnalysisList />
            </ModernLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/analysis/:id"
        element={
          <ProtectedRoute>
            <ModernLayout>
              <AnalysisDetail />
            </ModernLayout>
          </ProtectedRoute>
        }
      />
      
      <Route 
        path="/content" 
        element={
          <ProtectedRoute>
            <ModernLayout>
              <ModernContent />
            </ModernLayout>
          </ProtectedRoute>
        } 
      />
      
      <Route
        path="/insights"
        element={
          <ProtectedRoute>
            <ModernLayout>
              <EnhancedInsights />
            </ModernLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/predictions"
        element={
          <ProtectedRoute>
            <ModernLayout>
              <Predictions />
            </ModernLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/entities"
        element={
          <ProtectedRoute>
            <ModernLayout>
              <EntityAnalyticsPage />
            </ModernLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/intelligence"
        element={
          <ProtectedRoute>
            <ModernLayout>
              <IntelligenceDashboard />
            </ModernLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/earnings"
        element={
          <ProtectedRoute>
            <ModernLayout>
              <EarningsCalendarPage />
            </ModernLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/stocks/screener"
        element={
          <ProtectedRoute>
            <ModernLayout>
              <StockScreener />
            </ModernLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/stocks/scanner"
        element={
          <ProtectedRoute>
            <ModernLayout>
              <StockScannerPage />
            </ModernLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/queue"
        element={
          <ProtectedRoute>
            <ModernLayout>
              <QueueManagement />
            </ModernLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/queue-test"
        element={
          <ProtectedRoute>
            <ModernLayout>
              <QueueTest />
            </ModernLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/queue-debug"
        element={
          <ProtectedRoute>
            <ModernLayout>
              <QueueDebug />
            </ModernLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <ModernLayout>
              <ComingSoonPage title="Settings Page" />
            </ModernLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/help"
        element={
          <ProtectedRoute>
            <ModernLayout>
              <ComingSoonPage title="Help Page" />
            </ModernLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <ModernLayout>
              <AdminDashboard />
            </ModernLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};