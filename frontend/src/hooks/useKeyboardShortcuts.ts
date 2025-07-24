import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  description: string;
  action: () => void;
  category: string;
  global?: boolean;
}

export const useKeyboardShortcuts = () => {
  const navigate = useNavigate();
  const { toggleTheme } = useTheme();
  const { success, dismissAll } = useToast();
  const [showHelp, setShowHelp] = useState(false);

  const shortcuts: KeyboardShortcut[] = [
    // Navigation shortcuts
    {
      key: 'g',
      description: 'Go to Dashboard',
      action: () => navigate('/dashboard'),
      category: 'Navigation',
      global: true
    },
    {
      key: 'f',
      description: 'Go to Feeds',
      action: () => navigate('/feeds'),
      category: 'Navigation',
      global: true
    },
    {
      key: 'p',
      description: 'Go to Predictions',
      action: () => navigate('/predictions'),
      category: 'Navigation',
      global: true
    },
    {
      key: 'c',
      description: 'Go to Content',
      action: () => navigate('/content'),
      category: 'Navigation',
      global: true
    },
    {
      key: 'e',
      description: 'Go to Entity Analytics',
      action: () => navigate('/entity-analytics'),
      category: 'Navigation',
      global: true
    },
    {
      key: 'a',
      description: 'Go to Analysis',
      action: () => navigate('/analysis'),
      category: 'Navigation',
      global: true
    },

    // Search shortcuts
    {
      key: 'k',
      ctrl: true,
      description: 'Global Search',
      action: () => {
        const searchInput = document.querySelector('[data-search-input]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        } else {
          success('Global Search', 'Navigate to a page with search functionality');
        }
      },
      category: 'Search',
      global: true
    },
    {
      key: '/',
      description: 'Quick Search',
      action: () => {
        const searchInput = document.querySelector('[data-search-input]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      },
      category: 'Search',
      global: true
    },

    // Theme shortcuts
    {
      key: 't',
      ctrl: true,
      shift: true,
      description: 'Toggle Theme',
      action: toggleTheme,
      category: 'Interface',
      global: true
    },
    {
      key: 'd',
      ctrl: true,
      description: 'Toggle Dark Mode',
      action: toggleTheme,
      category: 'Interface',
      global: true
    },

    // Utility shortcuts
    {
      key: 'r',
      description: 'Refresh Page',
      action: () => {
        const refreshButton = document.querySelector('[data-refresh-button]') as HTMLButtonElement;
        if (refreshButton) {
          refreshButton.click();
        } else {
          window.location.reload();
        }
      },
      category: 'Utility',
      global: true
    },
    {
      key: '?',
      description: 'Show Keyboard Shortcuts',
      action: () => setShowHelp(true),
      category: 'Help',
      global: true
    },
    {
      key: 'Escape',
      description: 'Close Modals/Overlays',
      action: () => {
        // Close modals, overlays, etc.
        const closeButtons = document.querySelectorAll('[data-close-button]');
        closeButtons.forEach(button => (button as HTMLButtonElement).click());
        setShowHelp(false);
        dismissAll();
      },
      category: 'Utility',
      global: true
    },

    // Quick actions
    {
      key: 'n',
      ctrl: true,
      description: 'New Item',
      action: () => {
        const newButton = document.querySelector('[data-new-button]') as HTMLButtonElement;
        if (newButton) {
          newButton.click();
        } else {
          success('Quick Action', 'New item shortcut - navigate to a page with create functionality');
        }
      },
      category: 'Actions',
      global: true
    },
    {
      key: 's',
      ctrl: true,
      description: 'Save',
      action: () => {
        const saveButton = document.querySelector('[data-save-button]') as HTMLButtonElement;
        if (saveButton) {
          saveButton.click();
        }
      },
      category: 'Actions',
      global: true
    }
  ];

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement ||
      (event.target as HTMLElement)?.contentEditable === 'true'
    ) {
      // Allow escape to work everywhere
      if (event.key !== 'Escape') return;
    }

    const matchedShortcut = shortcuts.find(shortcut => {
      const keyMatch = shortcut.key.toLowerCase() === event.key.toLowerCase();
      const ctrlMatch = !!shortcut.ctrl === (event.ctrlKey || event.metaKey);
      const shiftMatch = !!shortcut.shift === event.shiftKey;
      const altMatch = !!shortcut.alt === event.altKey;

      return keyMatch && ctrlMatch && shiftMatch && altMatch;
    });

    if (matchedShortcut) {
      event.preventDefault();
      event.stopPropagation();
      matchedShortcut.action();
    }
  }, [shortcuts]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {
    shortcuts,
    showHelp,
    setShowHelp,
    categories: [...new Set(shortcuts.map(s => s.category))]
  };
};