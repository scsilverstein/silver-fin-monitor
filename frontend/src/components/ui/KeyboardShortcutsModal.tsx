import React from 'react';
import { X, Keyboard } from 'lucide-react';
import { ModernButton } from './ModernButton';
import { ModernBadge } from './ModernBadge';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './dialog';

const KeyboardShortcutsModal: React.FC = () => {
  const { shortcuts, showHelp, setShowHelp, categories } = useKeyboardShortcuts();

  const formatShortcut = (shortcut: any) => {
    const keys = [];
    if (shortcut.ctrl) keys.push('Ctrl');
    if (shortcut.shift) keys.push('Shift');
    if (shortcut.alt) keys.push('Alt');
    if (shortcut.meta) keys.push('Cmd');
    keys.push(shortcut.key.toUpperCase());
    return keys;
  };

  return (
    <Dialog open={showHelp} onOpenChange={setShowHelp}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {categories.map(category => (
            <div key={category} className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
                {category}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {shortcuts
                  .filter(shortcut => shortcut.category === category)
                  .map((shortcut, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {shortcut.description}
                      </span>
                      <div className="flex items-center gap-1">
                        {formatShortcut(shortcut).map((key, keyIndex) => (
                          <React.Fragment key={keyIndex}>
                            <ModernBadge variant="outline" className="text-xs font-mono">
                              {key}
                            </ModernBadge>
                            {keyIndex < formatShortcut(shortcut).length - 1 && (
                              <span className="text-xs text-gray-400">+</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Press <ModernBadge variant="outline" className="text-xs font-mono">ESC</ModernBadge> to close
          </div>
          <ModernButton onClick={() => setShowHelp(false)}>
            Close
          </ModernButton>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default KeyboardShortcutsModal;