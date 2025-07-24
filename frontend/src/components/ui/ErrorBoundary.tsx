import React, { Component, ErrorInfo, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { 
  AlertTriangle, 
  RefreshCw, 
  Home, 
  Bug, 
  Mail, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Copy,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  children: ReactNode;
  fallbackComponent?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  copied: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      copied: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    
    // Log error to console
    console.error('Error Boundary caught an error:', error, errorInfo);
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Report to error tracking service
    this.reportError(error, errorInfo);
  }

  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    // Here you would integrate with your error tracking service
    // Example: Sentry.captureException(error, { extra: errorInfo });
    
    // For now, we'll just log it
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    // You could send this to your backend or error tracking service
    console.log('Error Report:', errorReport);
  };

  private handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        showDetails: false
      });
    } else {
      // Max retries reached, maybe redirect or show different UI
      this.handleGoHome();
    }
  };

  private handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleToggleDetails = () => {
    this.setState({ showDetails: !this.state.showDetails });
  };

  private handleCopyError = async () => {
    const { error, errorInfo } = this.state;
    const errorText = `
Error: ${error?.message}
Stack: ${error?.stack}
Component Stack: ${errorInfo?.componentStack}
URL: ${window.location.href}
Timestamp: ${new Date().toISOString()}
User Agent: ${navigator.userAgent}
    `.trim();

    try {
      await navigator.clipboard.writeText(errorText);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch (err) {
      console.error('Failed to copy error details:', err);
    }
  };

  private handleReportBug = () => {
    const { error } = this.state;
    const subject = `Bug Report: ${error?.message || 'Application Error'}`;
    const body = `
I encountered an error while using Silver Fin Monitor:

Error: ${error?.message}
URL: ${window.location.href}
Timestamp: ${new Date().toISOString()}

Steps to reproduce:
1. 
2. 
3. 

Additional context:

    `.trim();

    const mailtoUrl = `mailto:support@silverfin.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl);
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallbackComponent) {
        return this.props.fallbackComponent;
      }

      const { error, errorInfo, showDetails, copied } = this.state;

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <motion.div
            className="max-w-2xl w-full"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="glass rounded-lg border border-border/50 overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-border/50 bg-destructive/5">
                <div className="flex items-center gap-4">
                  <motion.div
                    className="p-3 bg-destructive/10 rounded-full"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: 10000 }}
                  >
                    <AlertTriangle className="h-8 w-8 text-destructive" />
                  </motion.div>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">
                      Oops! Something went wrong
                    </h1>
                    <p className="text-muted-foreground mt-1">
                      We encountered an unexpected error. Don't worry, we're on it!
                    </p>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              <div className="p-6">
                <div className="bg-muted/30 rounded-lg p-4 mb-6">
                  <h3 className="font-semibold mb-2">Error Details</h3>
                  <p className="text-sm text-muted-foreground font-mono">
                    {error?.message || 'Unknown error occurred'}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3 mb-6">
                  <motion.button
                    onClick={this.handleRetry}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground',
                      'rounded-lg hover:bg-primary/90 transition-colors font-medium'
                    )}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={this.retryCount >= this.maxRetries}
                  >
                    <RefreshCw className="h-4 w-4" />
                    {this.retryCount >= this.maxRetries ? 'Max Retries Reached' : 'Try Again'}
                  </motion.button>

                  <motion.button
                    onClick={this.handleGoHome}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground',
                      'rounded-lg hover:bg-secondary/90 transition-colors'
                    )}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Home className="h-4 w-4" />
                    Go to Dashboard
                  </motion.button>

                  <motion.button
                    onClick={this.handleReload}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 bg-muted text-muted-foreground',
                      'rounded-lg hover:bg-muted/80 transition-colors'
                    )}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Reload Page
                  </motion.button>
                </div>

                {/* Advanced Options */}
                <div className="border-t border-border/50 pt-6">
                  <button
                    onClick={this.handleToggleDetails}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
                  >
                    {showDetails ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    Technical Details
                  </button>

                  <motion.div
                    initial={false}
                    animate={{ height: showDetails ? 'auto' : 0, opacity: showDetails ? 1 : 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    {showDetails && (
                      <div className="space-y-4">
                        {/* Error Stack */}
                        <div>
                          <h4 className="text-sm font-medium mb-2">Error Stack</h4>
                          <div className="bg-muted/50 rounded p-3 text-xs font-mono max-h-40 overflow-y-auto">
                            <pre className="whitespace-pre-wrap">
                              {error?.stack || 'No stack trace available'}
                            </pre>
                          </div>
                        </div>

                        {/* Component Stack */}
                        {errorInfo?.componentStack && (
                          <div>
                            <h4 className="text-sm font-medium mb-2">Component Stack</h4>
                            <div className="bg-muted/50 rounded p-3 text-xs font-mono max-h-40 overflow-y-auto">
                              <pre className="whitespace-pre-wrap">
                                {errorInfo.componentStack}
                              </pre>
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-4 border-t border-border/50">
                          <motion.button
                            onClick={this.handleCopyError}
                            className={cn(
                              'flex items-center gap-2 px-3 py-2 text-sm',
                              'bg-muted text-muted-foreground hover:text-foreground',
                              'rounded transition-colors'
                            )}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            {copied ? (
                              <>
                                <Check className="h-4 w-4 text-green-500" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4" />
                                Copy Error
                              </>
                            )}
                          </motion.button>

                          <motion.button
                            onClick={this.handleReportBug}
                            className={cn(
                              'flex items-center gap-2 px-3 py-2 text-sm',
                              'bg-muted text-muted-foreground hover:text-foreground',
                              'rounded transition-colors'
                            )}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <Bug className="h-4 w-4" />
                            Report Bug
                          </motion.button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-muted/20 border-t border-border/50">
                <p className="text-xs text-muted-foreground text-center">
                  If this problem persists, please{' '}
                  <button
                    onClick={this.handleReportBug}
                    className="text-primary hover:underline"
                  >
                    contact support
                  </button>{' '}
                  or try refreshing the page.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Component wrapper for easier usage
export const withErrorBoundary = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) => {
  return (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );
};

export default ErrorBoundary;