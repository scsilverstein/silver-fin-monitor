import { useEffect, useCallback, useState } from 'react';

interface AccessibilitySettings {
  reducedMotion: boolean;
  highContrast: boolean;
  largeText: boolean;
  screenReader: boolean;
  keyboardNavigation: boolean;
}

export const useAccessibility = () => {
  const [settings, setSettings] = useState<AccessibilitySettings>({
    reducedMotion: false,
    highContrast: false,
    largeText: false,
    screenReader: false,
    keyboardNavigation: false,
  });

  const [announcements, setAnnouncements] = useState<string[]>([]);

  // Detect user preferences
  const detectPreferences = useCallback(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const highContrast = window.matchMedia('(prefers-contrast: high)').matches;
    const screenReader = 'speechSynthesis' in window || 'webkitSpeechSynthesis' in window;
    
    setSettings(prev => ({
      ...prev,
      reducedMotion,
      highContrast,
      screenReader
    }));

    // Apply accessibility classes to document
    document.documentElement.classList.toggle('reduced-motion', reducedMotion);
    document.documentElement.classList.toggle('high-contrast', highContrast);
  }, []);

  // Announce to screen readers
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    // Add to announcement queue
    setAnnouncements(prev => [...prev, message]);
    
    // Create live region if it doesn't exist
    let liveRegion = document.getElementById('aria-live-region');
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'aria-live-region';
      liveRegion.setAttribute('aria-live', priority);
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.className = 'sr-only';
      document.body.appendChild(liveRegion);
    }

    // Update live region
    liveRegion.textContent = message;
    
    // Clear announcement after a delay
    setTimeout(() => {
      setAnnouncements(prev => prev.filter(a => a !== message));
      if (liveRegion && liveRegion.textContent === message) {
        liveRegion.textContent = '';
      }
    }, 3000);
  }, []);

  // Focus management
  const focusElement = useCallback((selector: string | HTMLElement) => {
    const element = typeof selector === 'string' 
      ? document.querySelector(selector) as HTMLElement
      : selector;
    
    if (element) {
      element.focus();
      
      // Announce focus change for screen readers
      const label = element.getAttribute('aria-label') || 
                   element.getAttribute('aria-labelledby') ||
                   element.textContent?.trim() ||
                   'Element';
      
      announce(`Focused on ${label}`, 'polite');
    }
  }, [announce]);

  // Skip link functionality
  const addSkipLinks = useCallback(() => {
    const skipLinksContainer = document.getElementById('skip-links');
    if (!skipLinksContainer) {
      const container = document.createElement('div');
      container.id = 'skip-links';
      container.className = 'skip-links';
      container.innerHTML = `
        <a href="#main-content" class="skip-link">Skip to main content</a>
        <a href="#navigation" class="skip-link">Skip to navigation</a>
        <a href="#search" class="skip-link">Skip to search</a>
      `;
      document.body.insertBefore(container, document.body.firstChild);
    }
  }, []);

  // Keyboard navigation helpers
  const handleTabTrapping = useCallback((container: HTMLElement) => {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Color contrast helpers
  const checkContrast = useCallback((foreground: string, background: string) => {
    // Simplified contrast calculation - in production, use a proper library
    const getRelativeLuminance = (color: string) => {
      // Convert hex to RGB and calculate relative luminance
      const hex = color.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16) / 255;
      const g = parseInt(hex.substr(2, 2), 16) / 255;
      const b = parseInt(hex.substr(4, 2), 16) / 255;
      
      const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      
      return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    };

    const l1 = getRelativeLuminance(foreground);
    const l2 = getRelativeLuminance(background);
    const contrast = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    
    return {
      ratio: contrast,
      passAA: contrast >= 4.5,
      passAAA: contrast >= 7,
    };
  }, []);

  // Form accessibility helpers
  const validateFormAccessibility = useCallback((form: HTMLFormElement) => {
    const errors: string[] = [];
    
    // Check for labels
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach((input: Element) => {
      const htmlInput = input as HTMLInputElement;
      const hasLabel = htmlInput.labels?.length > 0 || 
                      htmlInput.getAttribute('aria-label') ||
                      htmlInput.getAttribute('aria-labelledby');
      
      if (!hasLabel) {
        errors.push(`Input ${htmlInput.name || htmlInput.type} is missing a label`);
      }
    });

    // Check for fieldsets in groups
    const radioGroups = form.querySelectorAll('input[type="radio"]');
    const checkboxGroups = form.querySelectorAll('input[type="checkbox"]');
    
    if (radioGroups.length > 1 || checkboxGroups.length > 1) {
      const hasFieldset = form.querySelector('fieldset');
      if (!hasFieldset) {
        errors.push('Form with multiple radio/checkbox inputs should use fieldset');
      }
    }

    return errors;
  }, []);

  // Focus visible helpers
  const manageFocusVisible = useCallback(() => {
    let hadKeyboardEvent = false;

    const handleKeyDown = () => {
      hadKeyboardEvent = true;
    };

    const handlePointerDown = () => {
      hadKeyboardEvent = false;
    };

    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (hadKeyboardEvent || target.matches(':focus-visible')) {
        target.classList.add('focus-visible');
      }
    };

    const handleBlur = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      target.classList.remove('focus-visible');
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('focus', handleFocus, true);
    document.addEventListener('blur', handleBlur, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('focus', handleFocus, true);
      document.removeEventListener('blur', handleBlur, true);
    };
  }, []);

  // Initialize accessibility features
  useEffect(() => {
    detectPreferences();
    addSkipLinks();
    const cleanup = manageFocusVisible();

    // Listen for preference changes
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const contrastQuery = window.matchMedia('(prefers-contrast: high)');
    
    const handleMotionChange = () => detectPreferences();
    const handleContrastChange = () => detectPreferences();
    
    motionQuery.addEventListener('change', handleMotionChange);
    contrastQuery.addEventListener('change', handleContrastChange);

    return () => {
      cleanup();
      motionQuery.removeEventListener('change', handleMotionChange);
      contrastQuery.removeEventListener('change', handleContrastChange);
    };
  }, [detectPreferences, addSkipLinks, manageFocusVisible]);

  return {
    settings,
    announcements,
    announce,
    focusElement,
    handleTabTrapping,
    checkContrast,
    validateFormAccessibility,
    manageFocusVisible,
  };
};