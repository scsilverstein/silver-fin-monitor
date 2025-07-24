# Layout Consolidation Guide

This guide shows how to migrate your existing pages to use the new shared layout components for better consistency and maintainability.

## ✅ **Completed Layout Consolidation**

The following shared components have been created and are ready for use:

### 1. **PageContainer** - Unified page wrapper
Replaces `ModernLayout` with consistent spacing and optional breadcrumbs.

### 2. **PageHeader** - Standardized page headers  
Includes title, subtitle, badges, search, and action buttons.

### 3. **StatsGrid** - Consistent metrics display
Responsive grid for displaying statistics with trends and interactions.

### 4. **LoadingState** - Unified loading indicators
Multiple variants (spinner, refresh, dots, skeleton) for different contexts.

### 5. **EmptyState** - Consistent empty states
Predefined empty states for common scenarios with actions.

### 6. **FilterBar** - Standardized filtering
Reusable filter component with search, selects, and active filter display.

### 7. **SharedModal** - Unified modal system
Standardized dialog component with variants for forms, confirmations, and info.

## ✅ **Migrated Pages**

The following pages have been successfully migrated to use the new shared components:

- **✅ Predictions** - Now uses PageContainer, PageHeader, StatsGrid, EmptyState
- **✅ QueueManagement** - Migrated with stats integration and shared actions  
- **✅ ModernFeeds** - Complete migration with enhanced stats and filters
- **✅ ModernContent** - Fully refactored with improved UX patterns
- **✅ ProcessedContent** - Enhanced with FilterBar and better state management

## Migration Patterns

### Before (Old Pattern)
```tsx
import { ModernLayout } from '@/components/layout';

const MyPage = () => {
  return (
    <ModernLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">My Page</h1>
          <button>Refresh</button>
        </div>
        
        <div className="grid grid-cols-4 gap-4">
          {/* stats cards */}
        </div>
        
        {loading ? (
          <div>Loading...</div>
        ) : data.length === 0 ? (
          <div>No data</div>
        ) : (
          <div>{/* content */}</div>
        )}
      </div>
    </ModernLayout>
  );
};
```

### After (New Pattern)
```tsx
import { 
  PageContainer, 
  PageHeader, 
  StatsGrid, 
  LoadingState, 
  EmptyState,
  createStatItems 
} from '@/components/layout';

const MyPage = () => {
  const stats = [
    createStatItems.count('total', 'Total Items', data.length),
    createStatItems.percentage('success', 'Success Rate', successRate),
  ];

  if (loading) {
    return (
      <PageContainer title="My Page" showBreadcrumbs>
        <LoadingState message="Loading..." fullScreen />
      </PageContainer>
    );
  }

  return (
    <PageContainer title="My Page" showBreadcrumbs>
      <PageHeader
        title="My Page"
        subtitle="Description of this page"
        onRefresh={handleRefresh}
        refreshing={refreshing}
        primaryActions={[{
          label: 'Create New',
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate
        }]}
      />

      <StatsGrid stats={stats} columns={4} loading={loading} />

      {data.length === 0 ? (
        <EmptyState
          title="No data available"
          description="Get started by adding some data."
          actions={[{
            label: 'Add Data',
            onClick: handleAdd
          }]}
        />
      ) : (
        <div>{/* content */}</div>
      )}
    </PageContainer>
  );
};
```

## Component Usage Examples

### 1. PageContainer
```tsx
<PageContainer 
  title="Optional meta title"
  showBreadcrumbs={true}
  showSidebar={true}
  fullWidth={false}
  className="custom-class"
>
  {children}
</PageContainer>
```

### 2. PageHeader
```tsx
<PageHeader
  title="Page Title"
  subtitle="Optional description"
  badges={[
    { label: 'Live', variant: 'info', dot: true },
    { label: '24 Total', variant: 'outline' }
  ]}
  showSearch={true}
  searchQuery={searchQuery}
  searchPlaceholder="Search items..."
  onSearchChange={setSearchQuery}
  onRefresh={handleRefresh}
  refreshing={loading}
  primaryActions={[
    {
      label: 'Create New',
      icon: <Plus className="h-4 w-4" />,
      onClick: handleCreate,
      loading: creating
    }
  ]}
  secondaryActions={[
    createPageActions.export(handleExport),
    createPageActions.settings(openSettings)
  ]}
/>
```

### 3. StatsGrid
```tsx
const stats = [
  createStatItems.count('feeds', 'Total Feeds', feeds.length, {
    status: feeds.length > 10 ? 'success' : 'warning',
    clickable: true,
    onClick: () => navigate('/feeds')
  }),
  createStatItems.withTrend('processing', 'Processing Rate', '94.2%', 2.1, 'vs last week'),
  createStatItems.duration('avg_time', 'Avg Process Time', 125),
  createStatItems.currency('cost', 'Monthly Cost', 1250.50)
];

<StatsGrid stats={stats} columns={4} loading={loading} />
```

### 4. LoadingState
```tsx
// Page loading
<LoadingState message="Loading page..." fullScreen />

// Content loading  
<ContentLoadingState message="Loading feeds..." />

// Inline loading
<InlineLoadingState />

// Skeleton loading
<SkeletonLoadingState />
```

### 5. EmptyState
```tsx
// Custom empty state
<EmptyState
  icon={<Database className="h-12 w-12 text-muted-foreground" />}
  title="No data available"
  description="There's nothing here yet."
  actions={[
    {
      label: 'Add Data',
      onClick: handleAdd,
      icon: <Plus className="h-4 w-4" />
    },
    {
      label: 'Import',
      onClick: handleImport,
      variant: 'outline'
    }
  ]}
/>

// Predefined empty states
<NoDataEmptyState onRefresh={refresh} onCreate={create} />
<NoSearchResultsEmptyState searchQuery={query} onClearSearch={clear} />
<NoPredictionsEmptyState onGenerate={generate} />
<NoContentEmptyState onAddFeed={addFeed} onRefresh={refresh} />
```

### 6. FilterBar
```tsx
const filters = [
  createFilter.select('status', 'Status', [
    { value: 'all', label: 'All Status', count: 50 },
    { value: 'active', label: 'Active', count: 30 },
    { value: 'inactive', label: 'Inactive', count: 20 }
  ], selectedStatus),
  createFilter.select('type', 'Type', typeOptions, selectedType)
];

<FilterBar
  searchQuery={searchQuery}
  searchPlaceholder="Search feeds..."
  onSearchChange={setSearchQuery}
  filters={filters}
  onFilterChange={handleFilterChange}
  onClearFilters={clearAllFilters}
  activeFiltersCount={getActiveFiltersCount()}
  showFilterToggle={true}
  collapsed={filtersCollapsed}
  onToggleCollapse={setFiltersCollapsed}
/>
```

## Page-Specific Migration Examples

### Dashboard Page
```tsx
<PageContainer showBreadcrumbs>
  <PageHeader
    title="Market Intelligence Dashboard" 
    subtitle="Real-time market analysis and insights"
    badges={[{ label: 'Live', variant: 'info', dot: true }]}
    onRefresh={refreshData}
    primaryActions={[{
      label: 'Generate Analysis',
      onClick: generateAnalysis,
      loading: generating
    }]}
  />
  
  <StatsGrid stats={dashboardStats} columns={4} />
  
  {/* Dashboard content */}
</PageContainer>
```

### Feeds Management  
```tsx
<PageContainer title="Feed Management" showBreadcrumbs>
  <PageHeader
    title="Feed Sources"
    subtitle="Manage your content feed sources"
    showSearch={true}
    searchQuery={searchQuery}
    onSearchChange={setSearchQuery}
    primaryActions={[createPageActions.add(handleAddFeed)]}
    secondaryActions={[
      createPageActions.export(handleExport),
      {
        label: 'Bulk Process',
        onClick: handleBulkProcess,
        icon: <Play className="h-4 w-4" />
      }
    ]}
  />
  
  <StatsGrid stats={feedStats} columns={4} />
  
  <FilterBar
    filters={feedFilters}
    onFilterChange={handleFilterChange}
    activeFiltersCount={activeFilters}
  />
  
  {filteredFeeds.length === 0 ? (
    <NoContentEmptyState onAddFeed={handleAddFeed} />
  ) : (
    <FeedList feeds={filteredFeeds} />
  )}
</PageContainer>
```

### Content Pages
```tsx
<PageContainer title="Processed Content" showBreadcrumbs>
  <PageHeader
    title="Content Library"
    subtitle="Browse and analyze processed content"
    showSearch={true}
    searchQuery={searchQuery}
    onSearchChange={setSearchQuery}
    onRefresh={refreshContent}
  />
  
  <StatsGrid stats={contentStats} columns={3} />
  
  {loading ? (
    <ContentLoadingState />
  ) : content.length === 0 ? (
    <NoContentEmptyState onRefresh={refreshContent} />
  ) : (
    <ContentGrid content={filteredContent} />
  )}
</PageContainer>
```

## Benefits of New System

### 1. **Consistency**
- Uniform spacing and layout patterns
- Consistent component behavior across pages
- Standardized visual hierarchy

### 2. **Maintainability** 
- Single source of truth for layout patterns
- Easy to update styles across all pages
- Reduced code duplication

### 3. **Developer Experience**
- Pre-built components for common patterns
- Helper functions for creating stats and filters
- TypeScript support with full intellisense

### 4. **Performance**
- Shared components reduce bundle size
- Optimized loading states and animations
- Efficient re-rendering patterns

### 5. **Accessibility**
- Built-in ARIA labels and keyboard navigation
- Consistent focus management
- Screen reader friendly components

## Migration Checklist

For each page, follow this checklist:

- [ ] Replace `ModernLayout` with `PageContainer`
- [ ] Replace custom headers with `PageHeader`
- [ ] Convert stats cards to `StatsGrid`
- [ ] Replace loading indicators with `LoadingState`
- [ ] Replace empty states with `EmptyState`
- [ ] Convert filters to `FilterBar` (if applicable)
- [ ] Update imports to use new components
- [ ] Test responsive behavior
- [ ] Verify accessibility features
- [ ] Remove old custom components if no longer used

## Next Steps

1. **Start with simple pages** - Begin with pages that have basic layouts
2. **Test thoroughly** - Ensure all functionality works after migration  
3. **Update incrementally** - Migrate one page at a time
4. **Remove old code** - Clean up unused custom components
5. **Document changes** - Update any relevant documentation

This consolidation will significantly improve your codebase maintainability while providing a consistent user experience across your entire application.