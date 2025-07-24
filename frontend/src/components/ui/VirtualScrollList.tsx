import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface VirtualScrollItem {
  id: string | number;
  height?: number;
  data: any;
}

interface VirtualScrollListProps<T = any> {
  items: VirtualScrollItem[];
  renderItem: (item: VirtualScrollItem, index: number, isVisible: boolean) => React.ReactNode;
  itemHeight?: number | ((item: VirtualScrollItem, index: number) => number);
  containerHeight: number;
  overscan?: number;
  className?: string;
  onScroll?: (scrollTop: number, scrollHeight: number, clientHeight: number) => void;
  onEndReached?: () => void;
  endReachedThreshold?: number;
  loading?: boolean;
  loadingComponent?: React.ReactNode;
  emptyComponent?: React.ReactNode;
  estimatedItemHeight?: number;
  horizontal?: boolean;
  gap?: number;
  onItemsRendered?: (startIndex: number, endIndex: number, visibleItems: VirtualScrollItem[]) => void;
}

interface ViewportInfo {
  startIndex: number;
  endIndex: number;
  offsetBefore: number;
  offsetAfter: number;
  visibleItems: VirtualScrollItem[];
}

export const VirtualScrollList = <T,>({
  items,
  renderItem,
  itemHeight = 50,
  containerHeight,
  overscan = 5,
  className,
  onScroll,
  onEndReached,
  endReachedThreshold = 200,
  loading = false,
  loadingComponent,
  emptyComponent,
  estimatedItemHeight = 50,
  horizontal = false,
  gap = 0,
  onItemsRendered,
}: VirtualScrollListProps<T>) => {
  const [scrollOffset, setScrollOffset] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const [measuredHeights, setMeasuredHeights] = useState<Map<string | number, number>>(new Map());
  
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  const lastScrollTop = useRef(0);
  const itemRefs = useRef<Map<string | number, HTMLElement>>(new Map());

  // Memoized item heights calculation
  const itemHeights = useMemo(() => {
    return items.map((item, index) => {
      if (measuredHeights.has(item.id)) {
        return measuredHeights.get(item.id)!;
      }
      
      if (typeof itemHeight === 'function') {
        return itemHeight(item, index);
      }
      
      return item.height || itemHeight || estimatedItemHeight;
    });
  }, [items, itemHeight, measuredHeights, estimatedItemHeight]);

  // Calculate cumulative offsets for efficient range queries
  const cumulativeHeights = useMemo(() => {
    const cumulative = [0];
    let total = 0;
    
    for (let i = 0; i < itemHeights.length; i++) {
      total += itemHeights[i] + gap;
      cumulative.push(total);
    }
    
    return cumulative;
  }, [itemHeights, gap]);

  // Binary search for efficient range finding
  const findStartIndex = useCallback((scrollTop: number) => {
    let low = 0;
    let high = cumulativeHeights.length - 1;
    
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (cumulativeHeights[mid] <= scrollTop) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    
    return Math.max(0, high);
  }, [cumulativeHeights]);

  // Calculate viewport information
  const viewportInfo = useMemo((): ViewportInfo => {
    const scrollTop = scrollOffset;
    const viewportHeight = containerHeight;
    
    if (items.length === 0) {
      return {
        startIndex: 0,
        endIndex: 0,
        offsetBefore: 0,
        offsetAfter: 0,
        visibleItems: [],
      };
    }

    const startIndex = Math.max(0, findStartIndex(scrollTop) - overscan);
    let endIndex = startIndex;
    let currentOffset = cumulativeHeights[startIndex];
    
    // Find end index
    while (endIndex < items.length && currentOffset < scrollTop + viewportHeight + (overscan * estimatedItemHeight)) {
      currentOffset += itemHeights[endIndex] + gap;
      endIndex++;
    }
    
    endIndex = Math.min(items.length - 1, endIndex + overscan);
    
    const offsetBefore = cumulativeHeights[startIndex];
    const offsetAfter = cumulativeHeights[cumulativeHeights.length - 1] - cumulativeHeights[endIndex + 1];
    const visibleItems = items.slice(startIndex, endIndex + 1);

    return {
      startIndex,
      endIndex,
      offsetBefore,
      offsetAfter,
      visibleItems,
    };
  }, [scrollOffset, containerHeight, items, findStartIndex, overscan, cumulativeHeights, itemHeights, gap, estimatedItemHeight]);

  // Measure item heights for dynamic sizing
  const measureItem = useCallback((id: string | number, element: HTMLElement) => {
    const dimension = horizontal ? element.offsetWidth : element.offsetHeight;
    
    setMeasuredHeights(prev => {
      if (prev.get(id) !== dimension) {
        const newMap = new Map(prev);
        newMap.set(id, dimension);
        return newMap;
      }
      return prev;
    });
  }, [horizontal]);

  // Handle scroll events
  const handleScroll = useCallback((e: Event) => {
    const target = e.target as HTMLDivElement;
    const newScrollTop = horizontal ? target.scrollLeft : target.scrollTop;
    
    setScrollOffset(newScrollTop);
    setIsScrolling(true);

    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Set scrolling to false after scroll ends
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 150);

    // Call onScroll callback
    if (onScroll) {
      const scrollHeight = horizontal ? target.scrollWidth : target.scrollHeight;
      const clientHeight = horizontal ? target.clientWidth : target.clientHeight;
      onScroll(newScrollTop, scrollHeight, clientHeight);
    }

    // Check for end reached
    if (onEndReached) {
      const scrollHeight = horizontal ? target.scrollWidth : target.scrollHeight;
      const clientHeight = horizontal ? target.clientWidth : target.clientHeight;
      const threshold = endReachedThreshold;
      
      if (newScrollTop + clientHeight >= scrollHeight - threshold) {
        onEndReached();
      }
    }

    lastScrollTop.current = newScrollTop;
  }, [horizontal, onScroll, onEndReached, endReachedThreshold]);

  // Set up scroll listener
  useEffect(() => {
    const scrollElement = scrollElementRef.current;
    if (!scrollElement) return;

    scrollElement.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  // Call onItemsRendered when visible items change
  useEffect(() => {
    if (onItemsRendered) {
      onItemsRendered(viewportInfo.startIndex, viewportInfo.endIndex, viewportInfo.visibleItems);
    }
  }, [viewportInfo.startIndex, viewportInfo.endIndex, viewportInfo.visibleItems, onItemsRendered]);

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Handle empty state
  if (items.length === 0 && !loading) {
    return (
      <div 
        className={cn(
          'flex items-center justify-center',
          horizontal ? 'w-full' : 'h-full',
          className
        )}
        style={{ height: containerHeight }}
      >
        {emptyComponent || (
          <div className="text-center text-muted-foreground">
            <p>No items to display</p>
          </div>
        )}
      </div>
    );
  }

  const totalSize = cumulativeHeights[cumulativeHeights.length - 1] || 0;

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-hidden', className)}
      style={{
        [horizontal ? 'width' : 'height']: containerHeight,
      }}
    >
      <div
        ref={scrollElementRef}
        className={cn(
          'overflow-auto',
          horizontal ? 'flex' : 'block',
          isScrolling ? 'pointer-events-none' : 'pointer-events-auto'
        )}
        style={{
          [horizontal ? 'width' : 'height']: '100%',
          [horizontal ? 'overflowY' : 'overflowX']: 'hidden',
        }}
      >
        {/* Virtual scrolling container */}
        <div
          style={{
            [horizontal ? 'width' : 'height']: totalSize,
            [horizontal ? 'height' : 'width']: '100%',
            position: 'relative',
          }}
        >
          {/* Spacer before visible items */}
          {viewportInfo.offsetBefore > 0 && (
            <div
              style={{
                [horizontal ? 'width' : 'height']: viewportInfo.offsetBefore,
                [horizontal ? 'height' : 'width']: horizontal ? '100%' : 'auto',
                flexShrink: 0,
              }}
            />
          )}

          {/* Render visible items */}
          {viewportInfo.visibleItems.map((item, relativeIndex) => {
            const actualIndex = viewportInfo.startIndex + relativeIndex;
            const isVisible = !isScrolling || relativeIndex % 2 === 0; // Optimize during scrolling
            
            return (
              <motion.div
                key={item.id}
                ref={(el) => {
                  if (el) {
                    itemRefs.current.set(item.id, el);
                    measureItem(item.id, el);
                  }
                }}
                className={cn(
                  'flex-shrink-0',
                  isScrolling && 'will-change-transform'
                )}
                style={{
                  [horizontal ? 'width' : 'height']: itemHeights[actualIndex],
                  marginBottom: horizontal ? 0 : gap,
                  marginRight: horizontal ? gap : 0,
                }}
                initial={false}
                animate={{
                  opacity: isVisible ? 1 : 0.8,
                }}
                transition={{
                  duration: 0.1,
                }}
              >
                {renderItem(item, actualIndex, isVisible)}
              </motion.div>
            );
          })}

          {/* Spacer after visible items */}
          {viewportInfo.offsetAfter > 0 && (
            <div
              style={{
                [horizontal ? 'width' : 'height']: viewportInfo.offsetAfter,
                [horizontal ? 'height' : 'width']: horizontal ? '100%' : 'auto',
                flexShrink: 0,
              }}
            />
          )}

          {/* Loading indicator */}
          {loading && (
            <div className="flex justify-center items-center p-4">
              {loadingComponent || (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Scroll indicator */}
      {isScrolling && (
        <motion.div
          className="absolute right-2 top-2 bg-primary/20 text-primary px-2 py-1 rounded text-xs"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {Math.round((scrollOffset / (totalSize - containerHeight)) * 100)}%
        </motion.div>
      )}
    </div>
  );
};

// Utility hook for managing virtual scroll state
export const useVirtualScroll = <T,>(
  items: T[],
  containerHeight: number,
  itemHeight: number | ((item: T, index: number) => number) = 50
) => {
  const [virtualItems, setVirtualItems] = useState<VirtualScrollItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Convert items to virtual scroll format
  useEffect(() => {
    const converted = items.map((item, index) => ({
      id: `item-${index}`,
      data: item,
      height: typeof itemHeight === 'function' ? itemHeight(item, index) : itemHeight,
    }));
    
    setVirtualItems(converted);
  }, [items, itemHeight]);

  const loadMore = useCallback(async (loadFn: () => Promise<T[]>) => {
    setLoading(true);
    try {
      const newItems = await loadFn();
      const newVirtualItems = newItems.map((item, index) => ({
        id: `item-${items.length + index}`,
        data: item,
        height: typeof itemHeight === 'function' 
          ? itemHeight(item, items.length + index) 
          : itemHeight,
      }));
      
      setVirtualItems(prev => [...prev, ...newVirtualItems]);
    } finally {
      setLoading(false);
    }
  }, [items.length, itemHeight]);

  return {
    virtualItems,
    loading,
    loadMore,
  };
};