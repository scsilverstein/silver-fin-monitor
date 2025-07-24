import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AppRoutes } from './routes/AppRoutes';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { ConnectionStatus } from './components/common/ConnectionStatus';
import KeyboardShortcutsModal from './components/ui/KeyboardShortcutsModal';
import { AnimatePresence } from 'framer-motion';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { GlobalLoadingIndicator, useGlobalLoading } from './components/ui/GlobalLoadingIndicator';
import { QuickActionsButton } from './components/ui/QuickActionsPanel';
import { useAccessibility } from './hooks/useAccessibility';

// Import test API for debugging
import './lib/test-api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1
    }
  }
});

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider position="top-right" maxToasts={5}>
            <BrowserRouter>
              <AccessibilityProvider>
                <AnimatePresence mode="wait">
                  <AppRoutes />
                </AnimatePresence>
                <KeyboardShortcutsModal />
                <QuickActionsButton position="bottom-right" />
              </AccessibilityProvider>
            </BrowserRouter>
            <ConnectionStatus />
            <ReactQueryDevtools initialIsOpen={false} />
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

// Accessibility Provider Component
const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useAccessibility();
  return <>{children}</>;
};

export default App;