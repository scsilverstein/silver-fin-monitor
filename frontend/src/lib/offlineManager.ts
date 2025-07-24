// Enhanced Offline Manager with Complete Functionality
import { useCallback, useEffect, useRef, useState } from 'react';

export interface OfflineAction {
  id: string;
  type: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  data?: any;
  headers?: Record<string, string>;
  timestamp: number;
  retries: number;
  maxRetries: number;
  priority: 'low' | 'normal' | 'high' | 'critical';
  dependencies?: string[];
}

export interface OfflineData {
  key: string;
  data: any;
  timestamp: number;
  expiresAt?: number;
  syncedAt?: number;
  size: number;
  priority: 'low' | 'normal' | 'high' | 'critical';
  compressed?: boolean;
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingActions: number;
  lastSyncTime: number;
  syncProgress: number;
  errors: string[];
  conflictsCount: number;
}

class OfflineManagerService {
  private dbName = 'SilverFinOfflineDB';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;
  private isInitialized = false;
  
  private syncQueue: OfflineAction[] = [];
  private offlineData = new Map<string, OfflineData>();
  private listeners = new Set<(status: SyncStatus) => void>();
  private syncInProgress = false;
  private conflictResolver?: (local: any, remote: any) => any;
  
  private status: SyncStatus = {
    isOnline: navigator.onLine,
    isSyncing: false,
    pendingActions: 0,
    lastSyncTime: 0,
    syncProgress: 0,
    errors: [],
    conflictsCount: 0,
  };

  constructor() {
    this.initialize();
    this.setupEventListeners();
  }

  // Initialize IndexedDB
  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.db = await this.openDB();
      await this.loadPersistedData();
      this.isInitialized = true;
      
      // Start periodic sync when online
      if (navigator.onLine) {
        this.startPeriodicSync();
      }
    } catch (error) {
      console.error('Failed to initialize offline manager:', error);
    }
  }

  // Open IndexedDB database
  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create stores
        if (!db.objectStoreNames.contains('actions')) {
          const actionsStore = db.createObjectStore('actions', { keyPath: 'id' });
          actionsStore.createIndex('timestamp', 'timestamp');
          actionsStore.createIndex('priority', 'priority');
        }
        
        if (!db.objectStoreNames.contains('data')) {
          const dataStore = db.createObjectStore('data', { keyPath: 'key' });
          dataStore.createIndex('timestamp', 'timestamp');
          dataStore.createIndex('expiresAt', 'expiresAt');
        }
        
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      };
    });
  }

  // Load persisted data from IndexedDB
  private async loadPersistedData(): Promise<void> {
    if (!this.db) return;

    try {
      // Load pending actions
      const actionsTransaction = this.db.transaction(['actions'], 'readonly');
      const actionsStore = actionsTransaction.objectStore('actions');
      const actionsRequest = actionsStore.getAll();
      
      actionsRequest.onsuccess = () => {
        this.syncQueue = actionsRequest.result;
        this.updateStatus({ pendingActions: this.syncQueue.length });
      };

      // Load offline data
      const dataTransaction = this.db.transaction(['data'], 'readonly');
      const dataStore = dataTransaction.objectStore('data');
      const dataRequest = dataStore.getAll();
      
      dataRequest.onsuccess = () => {
        this.offlineData.clear();
        dataRequest.result.forEach(item => {
          // Check if data is expired
          if (!item.expiresAt || Date.now() < item.expiresAt) {
            this.offlineData.set(item.key, item);
          }
        });
      };

      // Load last sync time
      const metadataTransaction = this.db.transaction(['metadata'], 'readonly');
      const metadataStore = metadataTransaction.objectStore('metadata');
      const syncTimeRequest = metadataStore.get('lastSyncTime');
      
      syncTimeRequest.onsuccess = () => {
        if (syncTimeRequest.result) {
          this.status.lastSyncTime = syncTimeRequest.result.value;
        }
      };
    } catch (error) {
      console.error('Failed to load persisted data:', error);
    }
  }

  // Setup event listeners
  private setupEventListeners(): void {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    
    // Listen for page visibility changes
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Listen for before unload to save pending data
    window.addEventListener('beforeunload', this.handleBeforeUnload);
  }

  private handleOnline = (): void => {
    this.updateStatus({ isOnline: true, errors: [] });
    this.startSync();
    this.startPeriodicSync();
  };

  private handleOffline = (): void => {
    this.updateStatus({ isOnline: false });
    this.stopPeriodicSync();
  };

  private handleVisibilityChange = (): void => {
    if (!document.hidden && navigator.onLine) {
      this.startSync();
    }
  };

  private handleBeforeUnload = (): void => {
    // Save any pending data
    this.persistPendingData();
  };

  // Add action to sync queue
  async addAction(action: Omit<OfflineAction, 'id' | 'timestamp' | 'retries'>): Promise<string> {
    const fullAction: OfflineAction = {
      ...action,
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retries: 0,
      maxRetries: action.maxRetries || 3,
    };

    this.syncQueue.push(fullAction);
    this.updateStatus({ pendingActions: this.syncQueue.length });
    
    // Persist to IndexedDB
    await this.persistAction(fullAction);
    
    // Try to sync immediately if online
    if (navigator.onLine) {
      this.startSync();
    }

    return fullAction.id;
  }

  // Store data for offline use
  async storeData(key: string, data: any, options: {
    priority?: OfflineData['priority'];
    expiresIn?: number; // milliseconds
    compress?: boolean;
  } = {}): Promise<void> {
    const now = Date.now();
    const serializedData = JSON.stringify(data);
    const size = new Blob([serializedData]).size;
    
    let processedData = data;
    if (options.compress && size > 1024) {
      // Simple compression using JSON stringify with reduced precision for numbers
      processedData = this.compressData(data);
    }

    const offlineData: OfflineData = {
      key,
      data: processedData,
      timestamp: now,
      expiresAt: options.expiresIn ? now + options.expiresIn : undefined,
      size,
      priority: options.priority || 'normal',
      compressed: options.compress,
    };

    this.offlineData.set(key, offlineData);
    await this.persistData(offlineData);
  }

  // Retrieve stored data
  async getData(key: string): Promise<any | null> {
    const data = this.offlineData.get(key);
    
    if (!data) {
      return null;
    }

    // Check if expired
    if (data.expiresAt && Date.now() > data.expiresAt) {
      this.offlineData.delete(key);
      await this.removePersistedData(key);
      return null;
    }

    // Decompress if needed
    if (data.compressed) {
      return this.decompressData(data.data);
    }

    return data.data;
  }

  // Remove stored data
  async removeData(key: string): Promise<void> {
    this.offlineData.delete(key);
    await this.removePersistedData(key);
  }

  // Start synchronization
  private async startSync(): Promise<void> {
    if (this.syncInProgress || !navigator.onLine || this.syncQueue.length === 0) {
      return;
    }

    this.syncInProgress = true;
    this.updateStatus({ isSyncing: true, syncProgress: 0, errors: [] });

    try {
      // Sort actions by priority and timestamp
      const sortedActions = [...this.syncQueue].sort((a, b) => {
        const priorityWeight = { critical: 4, high: 3, normal: 2, low: 1 };
        const priorityDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
        return priorityDiff !== 0 ? priorityDiff : a.timestamp - b.timestamp;
      });

      let completedActions = 0;
      const errors: string[] = [];

      for (const action of sortedActions) {
        try {
          // Check dependencies
          if (action.dependencies && !this.areDependenciesMet(action.dependencies)) {
            continue;
          }

          await this.executeAction(action);
          await this.removeAction(action.id);
          completedActions++;
          
          // Update progress
          this.updateStatus({
            syncProgress: (completedActions / sortedActions.length) * 100,
            pendingActions: this.syncQueue.length - completedActions,
          });

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push(`${action.type}: ${errorMessage}`);
          
          // Increment retry count
          action.retries++;
          
          if (action.retries >= action.maxRetries) {
            // Max retries reached, remove from queue
            await this.removeAction(action.id);
            console.error(`Action ${action.id} failed after ${action.maxRetries} retries:`, error);
          } else {
            // Update action in storage
            await this.persistAction(action);
          }
        }

        // Yield control to prevent blocking
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      // Update last sync time
      const now = Date.now();
      this.updateStatus({ 
        lastSyncTime: now,
        errors,
      });
      await this.persistMetadata('lastSyncTime', now);

    } finally {
      this.syncInProgress = false;
      this.updateStatus({ 
        isSyncing: false, 
        syncProgress: 100,
        pendingActions: this.syncQueue.length,
      });
    }
  }

  // Execute a single action
  private async executeAction(action: OfflineAction): Promise<any> {
    const response = await fetch(action.url, {
      method: action.method,
      headers: {
        'Content-Type': 'application/json',
        ...action.headers,
      },
      body: action.data ? JSON.stringify(action.data) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // Check if action dependencies are met
  private areDependenciesMet(dependencies: string[]): boolean {
    return dependencies.every(depId => 
      !this.syncQueue.some(action => action.id === depId)
    );
  }

  // Remove action from queue
  private async removeAction(actionId: string): Promise<void> {
    const index = this.syncQueue.findIndex(action => action.id === actionId);
    if (index > -1) {
      this.syncQueue.splice(index, 1);
    }
    
    if (this.db) {
      const transaction = this.db.transaction(['actions'], 'readwrite');
      const store = transaction.objectStore('actions');
      await store.delete(actionId);
    }
  }

  // Persist action to IndexedDB
  private async persistAction(action: OfflineAction): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction(['actions'], 'readwrite');
    const store = transaction.objectStore('actions');
    await store.put(action);
  }

  // Persist data to IndexedDB
  private async persistData(data: OfflineData): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction(['data'], 'readwrite');
    const store = transaction.objectStore('data');
    await store.put(data);
  }

  // Remove persisted data
  private async removePersistedData(key: string): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction(['data'], 'readwrite');
    const store = transaction.objectStore('data');
    await store.delete(key);
  }

  // Persist metadata
  private async persistMetadata(key: string, value: any): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction(['metadata'], 'readwrite');
    const store = transaction.objectStore('metadata');
    await store.put({ key, value });
  }

  // Persist pending data before page unload
  private async persistPendingData(): Promise<void> {
    if (!this.db) return;

    try {
      // Persist all pending actions
      const transaction = this.db.transaction(['actions'], 'readwrite');
      const store = transaction.objectStore('actions');
      
      for (const action of this.syncQueue) {
        store.put(action);
      }
    } catch (error) {
      console.error('Failed to persist pending data:', error);
    }
  }

  // Simple data compression
  private compressData(data: any): any {
    if (typeof data === 'object' && data !== null) {
      if (Array.isArray(data)) {
        return data.map(item => this.compressData(item));
      } else {
        const compressed: any = {};
        for (const [key, value] of Object.entries(data)) {
          compressed[key] = this.compressData(value);
        }
        return compressed;
      }
    } else if (typeof data === 'number') {
      // Round numbers to reduce precision
      return Math.round(data * 100) / 100;
    }
    return data;
  }

  // Simple data decompression
  private decompressData(data: any): any {
    // Since we're using simple compression, decompression is just returning the data
    return data;
  }

  // Periodic sync management
  private syncInterval: NodeJS.Timeout | null = null;

  private startPeriodicSync(): void {
    if (this.syncInterval) return;
    
    this.syncInterval = setInterval(() => {
      if (navigator.onLine && this.syncQueue.length > 0) {
        this.startSync();
      }
    }, 30000); // Sync every 30 seconds
  }

  private stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Update status and notify listeners
  private updateStatus(updates: Partial<SyncStatus>): void {
    this.status = { ...this.status, ...updates };
    this.listeners.forEach(listener => listener(this.status));
  }

  // Subscribe to status changes
  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status); // Send current status
    return () => this.listeners.delete(listener);
  }

  // Set conflict resolver
  setConflictResolver(resolver: (local: any, remote: any) => any): void {
    this.conflictResolver = resolver;
  }

  // Clear all offline data
  async clearAllData(): Promise<void> {
    this.offlineData.clear();
    this.syncQueue.length = 0;
    
    if (this.db) {
      const transaction = this.db.transaction(['actions', 'data'], 'readwrite');
      await transaction.objectStore('actions').clear();
      await transaction.objectStore('data').clear();
    }
    
    this.updateStatus({ pendingActions: 0 });
  }

  // Get storage usage
  async getStorageUsage(): Promise<{
    used: number;
    available: number;
    percentage: number;
  }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        return {
          used: estimate.usage || 0,
          available: estimate.quota || 0,
          percentage: estimate.quota ? ((estimate.usage || 0) / estimate.quota) * 100 : 0,
        };
      } catch (error) {
        console.error('Failed to get storage usage:', error);
      }
    }

    return { used: 0, available: 0, percentage: 0 };
  }

  // Cleanup expired data
  async cleanup(): Promise<void> {
    const now = Date.now();
    const keysToRemove: string[] = [];

    for (const [key, data] of this.offlineData) {
      if (data.expiresAt && now > data.expiresAt) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      await this.removeData(key);
    }
  }

  // Get current status
  getStatus(): SyncStatus {
    return { ...this.status };
  }

  // Destroy the offline manager
  destroy(): void {
    this.stopPeriodicSync();
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    
    if (this.db) {
      this.db.close();
    }
    
    this.listeners.clear();
  }
}

// Global instance
const offlineManager = new OfflineManagerService();

// React hook for offline functionality
export const useOfflineManager = () => {
  const [status, setStatus] = useState<SyncStatus>(offlineManager.getStatus());

  useEffect(() => {
    const unsubscribe = offlineManager.subscribe(setStatus);
    return unsubscribe;
  }, []);

  const addAction = useCallback(async (action: Omit<OfflineAction, 'id' | 'timestamp' | 'retries'>) => {
    return offlineManager.addAction(action);
  }, []);

  const storeData = useCallback(async (key: string, data: any, options?: Parameters<typeof offlineManager.storeData>[2]) => {
    return offlineManager.storeData(key, data, options);
  }, []);

  const getData = useCallback(async (key: string) => {
    return offlineManager.getData(key);
  }, []);

  const removeData = useCallback(async (key: string) => {
    return offlineManager.removeData(key);
  }, []);

  return {
    status,
    addAction,
    storeData,
    getData,
    removeData,
    isOnline: status.isOnline,
    isSyncing: status.isSyncing,
    pendingActions: status.pendingActions,
  };
};

// Hook for offline-first data fetching
export const useOfflineData = <T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    fallbackToCache?: boolean;
    cacheFirst?: boolean;
    syncInBackground?: boolean;
    expiresIn?: number;
  } = {}
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isStale, setIsStale] = useState(false);
  
  const { isOnline, storeData, getData } = useOfflineManager();

  const fetchData = useCallback(async (useCache = false) => {
    setLoading(true);
    setError(null);

    try {
      // Try cache first if specified or offline
      if (useCache || !isOnline || options.cacheFirst) {
        const cachedData = await getData(key);
        if (cachedData) {
          setData(cachedData);
          setIsStale(!isOnline);
          setLoading(false);
          
          // If cache first and online, fetch in background
          if (options.cacheFirst && isOnline && options.syncInBackground) {
            try {
              const freshData = await fetcher();
              await storeData(key, freshData, { expiresIn: options.expiresIn });
              setData(freshData);
              setIsStale(false);
            } catch (bgError) {
              console.warn('Background sync failed:', bgError);
            }
          }
          
          return cachedData;
        }
      }

      // Fetch fresh data if online
      if (isOnline) {
        const freshData = await fetcher();
        await storeData(key, freshData, { expiresIn: options.expiresIn });
        setData(freshData);
        setIsStale(false);
        return freshData;
      }

      // Fallback to cache if offline and fallback enabled
      if (options.fallbackToCache) {
        const cachedData = await getData(key);
        if (cachedData) {
          setData(cachedData);
          setIsStale(true);
          return cachedData;
        }
      }

      throw new Error('No data available offline');

    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error(String(err));
      setError(fetchError);
      
      // Try cache as last resort
      if (options.fallbackToCache) {
        const cachedData = await getData(key);
        if (cachedData) {
          setData(cachedData);
          setIsStale(true);
          return cachedData;
        }
      }
      
      throw fetchError;
    } finally {
      setLoading(false);
    }
  }, [key, fetcher, isOnline, getData, storeData, options]);

  // Initial fetch
  useEffect(() => {
    fetchData().catch(console.error);
  }, [fetchData]);

  const refetch = useCallback(() => fetchData(false), [fetchData]);
  const invalidate = useCallback(async () => {
    await removeData(key);
    setData(null);
    setIsStale(false);
  }, [key]);

  return {
    data,
    loading,
    error,
    isStale,
    refetch,
    invalidate,
  };
};

export default offlineManager;