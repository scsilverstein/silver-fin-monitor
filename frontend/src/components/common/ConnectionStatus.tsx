import React from 'react';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { 
  Wifi, 
  WifiOff, 
  Server, 
  ServerOff, 
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';

export const ConnectionStatus: React.FC = () => {
  const { isOnline, isBackendConnected, isChecking } = useConnectionStatus();

  // Don't show anything if everything is working fine
  if (isOnline && isBackendConnected && !isChecking) {
    return null;
  }

  // Show connection issues
  return (
    <div className="fixed top-4 right-4 z-50">
      <div className={`
        px-4 py-2 rounded-lg shadow-lg border flex items-center gap-2 text-sm font-medium
        ${!isOnline 
          ? 'bg-red-50 border-red-200 text-red-700' 
          : !isBackendConnected && !isChecking
          ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
          : 'bg-blue-50 border-blue-200 text-blue-700'
        }
      `}>
        {!isOnline ? (
          <>
            <WifiOff className="w-4 h-4" />
            <span>No internet connection</span>
          </>
        ) : isChecking ? (
          <>
            <Clock className="w-4 h-4 animate-spin" />
            <span>Checking server connection...</span>
          </>
        ) : !isBackendConnected ? (
          <>
            <ServerOff className="w-4 h-4" />
            <span>Cannot connect to server</span>
          </>
        ) : (
          <>
            <CheckCircle className="w-4 h-4" />
            <span>Connected</span>
          </>
        )}
      </div>
    </div>
  );
};