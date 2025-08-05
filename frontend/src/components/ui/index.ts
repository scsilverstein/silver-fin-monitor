// Legacy components (commented out to avoid conflicts)
// export * from './Card';
// export * from './Button';
// export * from './Input';
// export * from './Select';
// export * from './Badge';
// export * from './Skeleton';

// Modern components (primary)
export * from './ModernButton';
export * from './ModernCard';
export * from './ModernInput';
export * from './ModernBadge';
export * from './ModernSkeleton';
export * from './ModernSelect';
export * from './TranscriptionModal';
export * from './UTCClock';

// Re-export legacy components with different names if needed
export { Button } from './Button';
export { Input as LegacyInput } from './Input';
export { Select as LegacySelect } from './Select';
export { Badge as LegacyBadge } from './Badge';
export { Skeleton as LegacySkeleton } from './Skeleton';

// Export Card as default since ModernCard is the primary
export { ModernCard as Card } from './ModernCard';

// Additional exports for queue management
export * from './Alert';
export { Card as LegacyCard, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from './Card';
export { Select as SelectRoot, SelectTrigger, SelectContent, SelectItem, SelectValue } from './Select';

// Export tabs component
export * from './Tabs';

// Export ScrollArea component
export * from './ScrollArea';