// Touch Optimizations for Mobile Interactions
import { useCallback, useEffect, useRef, useState } from 'react';

// Touch gesture types
export interface TouchGesture {
  type: 'tap' | 'double-tap' | 'long-press' | 'swipe' | 'pinch' | 'pan' | 'rotate';
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  deltaX: number;
  deltaY: number;
  distance: number;
  duration: number;
  velocity: number;
  scale?: number;
  rotation?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}

export interface TouchConfig {
  tapThreshold?: number;
  longPressDelay?: number;
  swipeThreshold?: number;
  swipeVelocityThreshold?: number;
  doubleTapDelay?: number;
  preventScrolling?: boolean;
  enablePinch?: boolean;
  enableRotation?: boolean;
}

export interface TouchHandlers {
  onTap?: (gesture: TouchGesture, event: TouchEvent) => void;
  onDoubleTap?: (gesture: TouchGesture, event: TouchEvent) => void;
  onLongPress?: (gesture: TouchGesture, event: TouchEvent) => void;
  onSwipe?: (gesture: TouchGesture, event: TouchEvent) => void;
  onPinch?: (gesture: TouchGesture, event: TouchEvent) => void;
  onPan?: (gesture: TouchGesture, event: TouchEvent) => void;
  onRotate?: (gesture: TouchGesture, event: TouchEvent) => void;
  onTouchStart?: (event: TouchEvent) => void;
  onTouchMove?: (event: TouchEvent) => void;
  onTouchEnd?: (event: TouchEvent) => void;
}

class TouchGestureRecognizer {
  private element: HTMLElement;
  private config: Required<TouchConfig>;
  private handlers: TouchHandlers;
  
  private touchData = {
    startTime: 0,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    lastTouchCount: 0,
    isMoving: false,
    lastTapTime: 0,
    tapCount: 0,
    longPressTimer: null as NodeJS.Timeout | null,
  };

  private pinchData = {
    startDistance: 0,
    startScale: 1,
    currentScale: 1,
  };

  private rotationData = {
    startAngle: 0,
    currentAngle: 0,
    rotation: 0,
  };

  constructor(element: HTMLElement, handlers: TouchHandlers, config: TouchConfig = {}) {
    this.element = element;
    this.handlers = handlers;
    this.config = {
      tapThreshold: 10,
      longPressDelay: 500,
      swipeThreshold: 50,
      swipeVelocityThreshold: 0.5,
      doubleTapDelay: 300,
      preventScrolling: false,
      enablePinch: true,
      enableRotation: false,
      ...config,
    };

    this.bindEvents();
  }

  private bindEvents(): void {
    this.element.addEventListener('touchstart', this.handleTouchStart, { passive: !this.config.preventScrolling });
    this.element.addEventListener('touchmove', this.handleTouchMove, { passive: !this.config.preventScrolling });
    this.element.addEventListener('touchend', this.handleTouchEnd, { passive: !this.config.preventScrolling });
    this.element.addEventListener('touchcancel', this.handleTouchCancel, { passive: true });
  }

  private handleTouchStart = (event: TouchEvent): void => {
    const touch = event.touches[0];
    const now = Date.now();

    if (this.config.preventScrolling) {
      event.preventDefault();
    }

    // Clear any existing long press timer
    if (this.touchData.longPressTimer) {
      clearTimeout(this.touchData.longPressTimer);
      this.touchData.longPressTimer = null;
    }

    // Single touch
    if (event.touches.length === 1) {
      this.touchData.startTime = now;
      this.touchData.startX = touch.clientX;
      this.touchData.startY = touch.clientY;
      this.touchData.currentX = touch.clientX;
      this.touchData.currentY = touch.clientY;
      this.touchData.isMoving = false;

      // Start long press timer
      this.touchData.longPressTimer = setTimeout(() => {
        if (!this.touchData.isMoving) {
          this.handleLongPress(event);
        }
      }, this.config.longPressDelay);

      // Check for double tap
      if (now - this.touchData.lastTapTime < this.config.doubleTapDelay) {
        this.touchData.tapCount++;
      } else {
        this.touchData.tapCount = 1;
      }
    }

    // Multi-touch gestures
    if (event.touches.length === 2 && this.config.enablePinch) {
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      
      this.pinchData.startDistance = this.getDistance(touch1, touch2);
      this.pinchData.startScale = 1;
      
      if (this.config.enableRotation) {
        this.rotationData.startAngle = this.getAngle(touch1, touch2);
        this.rotationData.rotation = 0;
      }
    }

    this.touchData.lastTouchCount = event.touches.length;
    this.handlers.onTouchStart?.(event);
  };

  private handleTouchMove = (event: TouchEvent): void => {
    if (this.config.preventScrolling) {
      event.preventDefault();
    }

    const touch = event.touches[0];
    
    if (event.touches.length === 1) {
      this.touchData.currentX = touch.clientX;
      this.touchData.currentY = touch.clientY;
      
      const deltaX = this.touchData.currentX - this.touchData.startX;
      const deltaY = this.touchData.currentY - this.touchData.startY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (distance > this.config.tapThreshold) {
        this.touchData.isMoving = true;
        
        // Clear long press timer if moving
        if (this.touchData.longPressTimer) {
          clearTimeout(this.touchData.longPressTimer);
          this.touchData.longPressTimer = null;
        }

        // Handle pan gesture
        this.handlePan(event);
      }
    }

    // Handle pinch gesture
    if (event.touches.length === 2 && this.config.enablePinch) {
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      
      const currentDistance = this.getDistance(touch1, touch2);
      this.pinchData.currentScale = currentDistance / this.pinchData.startDistance;
      
      if (this.config.enableRotation) {
        const currentAngle = this.getAngle(touch1, touch2);
        this.rotationData.currentAngle = currentAngle;
        this.rotationData.rotation = currentAngle - this.rotationData.startAngle;
      }

      this.handlePinch(event);
      
      if (this.config.enableRotation) {
        this.handleRotate(event);
      }
    }

    this.handlers.onTouchMove?.(event);
  };

  private handleTouchEnd = (event: TouchEvent): void => {
    const now = Date.now();
    const duration = now - this.touchData.startTime;
    
    // Clear long press timer
    if (this.touchData.longPressTimer) {
      clearTimeout(this.touchData.longPressTimer);
      this.touchData.longPressTimer = null;
    }

    // Handle single touch gestures
    if (this.touchData.lastTouchCount === 1) {
      const deltaX = this.touchData.currentX - this.touchData.startX;
      const deltaY = this.touchData.currentY - this.touchData.startY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const velocity = distance / duration;

      if (!this.touchData.isMoving && distance <= this.config.tapThreshold) {
        // Handle tap
        if (this.touchData.tapCount === 1) {
          // Single tap - delay to check for double tap
          setTimeout(() => {
            if (this.touchData.tapCount === 1) {
              this.handleTap(event);
            }
            this.touchData.tapCount = 0;
          }, this.config.doubleTapDelay);
        } else if (this.touchData.tapCount === 2) {
          // Double tap
          this.handleDoubleTap(event);
          this.touchData.tapCount = 0;
        }
        
        this.touchData.lastTapTime = now;
      } else if (distance >= this.config.swipeThreshold && velocity >= this.config.swipeVelocityThreshold) {
        // Handle swipe
        this.handleSwipe(event);
      }
    }

    this.touchData.isMoving = false;
    this.handlers.onTouchEnd?.(event);
  };

  private handleTouchCancel = (event: TouchEvent): void => {
    if (this.touchData.longPressTimer) {
      clearTimeout(this.touchData.longPressTimer);
      this.touchData.longPressTimer = null;
    }
    
    this.touchData.isMoving = false;
  };

  private handleTap(event: TouchEvent): void {
    const gesture = this.createGesture('tap');
    this.handlers.onTap?.(gesture, event);
  }

  private handleDoubleTap(event: TouchEvent): void {
    const gesture = this.createGesture('double-tap');
    this.handlers.onDoubleTap?.(gesture, event);
  }

  private handleLongPress(event: TouchEvent): void {
    const gesture = this.createGesture('long-press');
    this.handlers.onLongPress?.(gesture, event);
  }

  private handleSwipe(event: TouchEvent): void {
    const gesture = this.createGesture('swipe');
    gesture.direction = this.getSwipeDirection();
    this.handlers.onSwipe?.(gesture, event);
  }

  private handlePan(event: TouchEvent): void {
    const gesture = this.createGesture('pan');
    this.handlers.onPan?.(gesture, event);
  }

  private handlePinch(event: TouchEvent): void {
    const gesture = this.createGesture('pinch');
    gesture.scale = this.pinchData.currentScale;
    this.handlers.onPinch?.(gesture, event);
  }

  private handleRotate(event: TouchEvent): void {
    const gesture = this.createGesture('rotate');
    gesture.rotation = this.rotationData.rotation;
    this.handlers.onRotate?.(gesture, event);
  }

  private createGesture(type: TouchGesture['type']): TouchGesture {
    const deltaX = this.touchData.currentX - this.touchData.startX;
    const deltaY = this.touchData.currentY - this.touchData.startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const duration = Date.now() - this.touchData.startTime;
    const velocity = distance / duration;

    return {
      type,
      startX: this.touchData.startX,
      startY: this.touchData.startY,
      currentX: this.touchData.currentX,
      currentY: this.touchData.currentY,
      deltaX,
      deltaY,
      distance,
      duration,
      velocity,
    };
  }

  private getSwipeDirection(): 'up' | 'down' | 'left' | 'right' {
    const deltaX = this.touchData.currentX - this.touchData.startX;
    const deltaY = this.touchData.currentY - this.touchData.startY;
    
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      return deltaX > 0 ? 'right' : 'left';
    } else {
      return deltaY > 0 ? 'down' : 'up';
    }
  }

  private getDistance(touch1: Touch, touch2: Touch): number {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private getAngle(touch1: Touch, touch2: Touch): number {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.atan2(dy, dx) * 180 / Math.PI;
  }

  public destroy(): void {
    this.element.removeEventListener('touchstart', this.handleTouchStart);
    this.element.removeEventListener('touchmove', this.handleTouchMove);
    this.element.removeEventListener('touchend', this.handleTouchEnd);
    this.element.removeEventListener('touchcancel', this.handleTouchCancel);
    
    if (this.touchData.longPressTimer) {
      clearTimeout(this.touchData.longPressTimer);
    }
  }
}

// React hook for touch gestures
export const useTouchGestures = (
  handlers: TouchHandlers,
  config: TouchConfig = {}
) => {
  const elementRef = useRef<HTMLElement | null>(null);
  const recognizerRef = useRef<TouchGestureRecognizer | null>(null);

  const ref = useCallback((element: HTMLElement | null) => {
    // Cleanup previous recognizer
    if (recognizerRef.current) {
      recognizerRef.current.destroy();
      recognizerRef.current = null;
    }

    elementRef.current = element;

    // Create new recognizer if element exists
    if (element) {
      recognizerRef.current = new TouchGestureRecognizer(element, handlers, config);
    }
  }, [handlers, config]);

  useEffect(() => {
    return () => {
      if (recognizerRef.current) {
        recognizerRef.current.destroy();
      }
    };
  }, []);

  return ref;
};

// Touch-optimized button component
export const useTouchOptimizedButton = (
  onPress: () => void,
  options: {
    hapticFeedback?: boolean;
    visualFeedback?: boolean;
    preventDoublePress?: boolean;
    pressDelay?: number;
  } = {}
) => {
  const [isPressed, setIsPressed] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);
  const lastPressTime = useRef(0);

  const handlePress = useCallback(() => {
    const now = Date.now();
    
    // Prevent double press
    if (options.preventDoublePress && now - lastPressTime.current < (options.pressDelay || 300)) {
      return;
    }

    lastPressTime.current = now;

    // Haptic feedback
    if (options.hapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }

    // Visual feedback
    if (options.visualFeedback) {
      setIsPressed(true);
      setTimeout(() => setIsPressed(false), 150);
    }

    // Temporary disable to prevent rapid presses
    if (options.preventDoublePress) {
      setIsDisabled(true);
      setTimeout(() => setIsDisabled(false), options.pressDelay || 300);
    }

    onPress();
  }, [onPress, options]);

  const touchHandlers = useTouchGestures({
    onTap: handlePress,
  }, {
    tapThreshold: 15,
    preventScrolling: false,
  });

  return {
    ref: touchHandlers,
    isPressed,
    isDisabled,
    className: isPressed ? 'touch-pressed' : '',
  };
};

// Hook for touch-optimized scrolling
export const useTouchScroll = (
  onScroll?: (deltaX: number, deltaY: number, velocity: number) => void,
  options: {
    momentum?: boolean;
    bounds?: { top?: number; bottom?: number; left?: number; right?: number };
    friction?: number;
  } = {}
) => {
  const scrollPosition = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });
  const animationFrame = useRef<number | null>(null);

  const handlePan = useCallback((gesture: TouchGesture) => {
    const deltaX = -gesture.deltaX;
    const deltaY = -gesture.deltaY;
    
    // Apply bounds
    if (options.bounds) {
      if (options.bounds.left !== undefined && scrollPosition.current.x + deltaX < options.bounds.left) {
        return;
      }
      if (options.bounds.right !== undefined && scrollPosition.current.x + deltaX > options.bounds.right) {
        return;
      }
      if (options.bounds.top !== undefined && scrollPosition.current.y + deltaY < options.bounds.top) {
        return;
      }
      if (options.bounds.bottom !== undefined && scrollPosition.current.y + deltaY > options.bounds.bottom) {
        return;
      }
    }

    scrollPosition.current.x += deltaX;
    scrollPosition.current.y += deltaY;
    velocity.current.x = deltaX / gesture.duration;
    velocity.current.y = deltaY / gesture.duration;

    onScroll?.(deltaX, deltaY, gesture.velocity);
  }, [onScroll, options.bounds]);

  const handleTouchEnd = useCallback(() => {
    if (options.momentum && (Math.abs(velocity.current.x) > 0.1 || Math.abs(velocity.current.y) > 0.1)) {
      const friction = options.friction || 0.95;
      
      const animate = () => {
        velocity.current.x *= friction;
        velocity.current.y *= friction;
        
        scrollPosition.current.x += velocity.current.x;
        scrollPosition.current.y += velocity.current.y;
        
        onScroll?.(velocity.current.x, velocity.current.y, Math.sqrt(velocity.current.x ** 2 + velocity.current.y ** 2));
        
        if (Math.abs(velocity.current.x) > 0.1 || Math.abs(velocity.current.y) > 0.1) {
          animationFrame.current = requestAnimationFrame(animate);
        }
      };
      
      animate();
    }
  }, [onScroll, options.momentum, options.friction]);

  const touchHandlers = useTouchGestures({
    onPan: handlePan,
    onTouchEnd: handleTouchEnd,
  }, {
    preventScrolling: true,
  });

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, []);

  return {
    ref: touchHandlers,
    scrollPosition: scrollPosition.current,
  };
};

// Hook for swipe-to-action
export const useSwipeActions = (
  actions: {
    left?: () => void;
    right?: () => void;
    up?: () => void;
    down?: () => void;
  },
  options: {
    threshold?: number;
    velocityThreshold?: number;
  } = {}
) => {
  const handleSwipe = useCallback((gesture: TouchGesture) => {
    const threshold = options.threshold || 100;
    const velocityThreshold = options.velocityThreshold || 0.5;
    
    if (gesture.distance < threshold || gesture.velocity < velocityThreshold) {
      return;
    }

    switch (gesture.direction) {
      case 'left':
        actions.left?.();
        break;
      case 'right':
        actions.right?.();
        break;
      case 'up':
        actions.up?.();
        break;
      case 'down':
        actions.down?.();
        break;
    }
  }, [actions, options]);

  const touchHandlers = useTouchGestures({
    onSwipe: handleSwipe,
  }, {
    swipeThreshold: options.threshold || 100,
    swipeVelocityThreshold: options.velocityThreshold || 0.5,
  });

  return touchHandlers;
};

// Device detection utilities
export const deviceUtils = {
  isTouchDevice: () => 'ontouchstart' in window || navigator.maxTouchPoints > 0,
  
  isIOS: () => /iPad|iPhone|iPod/.test(navigator.userAgent),
  
  isAndroid: () => /Android/.test(navigator.userAgent),
  
  getViewportSize: () => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }),
  
  isMobile: () => window.innerWidth < 768,
  
  isTablet: () => window.innerWidth >= 768 && window.innerWidth < 1024,
  
  supportsHaptics: () => 'vibrate' in navigator,
  
  getDevicePixelRatio: () => window.devicePixelRatio || 1,
  
  addTouchClass: () => {
    if (deviceUtils.isTouchDevice()) {
      document.documentElement.classList.add('touch-device');
    } else {
      document.documentElement.classList.add('no-touch');
    }
  },
};

// Initialize touch optimizations
export const initializeTouchOptimizations = () => {
  // Add device-specific classes
  deviceUtils.addTouchClass();
  
  // Add touch-specific CSS
  const style = document.createElement('style');
  style.textContent = `
    .touch-device {
      -webkit-tap-highlight-color: transparent;
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      user-select: none;
    }
    
    .touch-pressed {
      transform: scale(0.95);
      opacity: 0.7;
      transition: transform 0.1s ease, opacity 0.1s ease;
    }
    
    .touch-target {
      min-height: 44px;
      min-width: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .swipe-action {
      position: relative;
      overflow: hidden;
    }
    
    .swipe-action::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.1);
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    
    .swipe-action.swiping::after {
      opacity: 1;
    }
    
    @media (max-width: 768px) {
      .touch-optimized {
        padding: 12px 16px;
        font-size: 16px;
        line-height: 1.5;
      }
      
      .touch-optimized input,
      .touch-optimized button,
      .touch-optimized select {
        min-height: 44px;
        font-size: 16px;
      }
    }
  `;
  
  document.head.appendChild(style);
  
  // Prevent zoom on double tap for iOS
  if (deviceUtils.isIOS()) {
    document.addEventListener('touchend', (event) => {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    }, false);
  }
};

export default TouchGestureRecognizer;