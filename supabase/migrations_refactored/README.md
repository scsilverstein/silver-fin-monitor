# Silver Fin Monitor - Refactored Migrations

## Overview

This directory contains the refactored database migrations following clean architecture principles. Each migration has a single responsibility and follows proper dependency ordering.

## Migration Principles

### 1. Single Responsibility Principle (SRP)
Each migration file does exactly ONE thing:
- Creates ONE table
- Creates ONE index  
- Creates ONE function
- Creates ONE trigger
- Seeds ONE set of data

### 2. Dependency Order
Migrations are numbered to ensure proper dependency resolution:
- **001-010**: Extensions (no dependencies)
- **011-030**: Base tables (no foreign keys)
- **031-060**: Level 1 dependent tables
- **061-100**: Level 2 dependent tables
- **101-150**: Complex/junction tables
- **151-200**: Indexes
- **201-250**: Functions
- **251-280**: Triggers
- **281-300**: Views
- **301-350**: Seed data

### 3. Naming Convention
Files follow the pattern: `{number}_{action}_{object}.sql`
- `001_enable_uuid_extension.sql`
- `011_create_feed_sources_table.sql`
- `151_create_feed_sources_indexes.sql`
- `201_create_update_timestamp_function.sql`

### 4. Idempotency
All migrations use `IF NOT EXISTS` to be safely re-runnable:
```sql
CREATE TABLE IF NOT EXISTS ...
CREATE INDEX IF NOT EXISTS ...
CREATE OR REPLACE FUNCTION ...
```

## Directory Structure

```
migrations_refactored/
├── README.md                              # This file
├── migration_plan.md                      # Detailed migration plan
├── 001_enable_uuid_extension.sql         # Extensions
├── 002_enable_pgcrypto_extension.sql
├── 003_enable_pgvector_extension.sql
├── 004_enable_pg_trgm_extension.sql
├── 005_enable_btree_gist_extension.sql
├── 011_create_feed_sources_table.sql     # Base tables
├── 012_create_sectors_table.sql
├── 031_create_raw_feeds_table.sql        # Dependent tables
├── 032_create_industries_table.sql
├── 151_create_feed_sources_indexes.sql   # Indexes
├── 152_create_raw_feeds_indexes.sql
├── 201_create_update_timestamp_function.sql # Functions
├── 251_create_feed_sources_update_trigger.sql # Triggers
└── 301_seed_sectors.sql                  # Seed data
```

## Benefits

### 1. **Clear Dependencies**
No forward references or circular dependencies. Each migration can reference only objects created in earlier migrations.

### 2. **Easy Debugging**
When something fails, you know exactly which file created (or failed to create) each database object.

### 3. **Partial Deployment**
You can deploy up to any point in the sequence and have a working schema subset.

### 4. **Version Control Friendly**
Small, focused files are easier to review, diff, and merge.

### 5. **CI/CD Integration**
Sequential numbering makes automated deployment straightforward.

## Usage

### Running All Migrations
```bash
# Run all migrations in order
for file in $(ls *.sql | sort -n); do
    psql -d your_database -f "$file"
done
```

### Running Up to a Specific Point
```bash
# Run migrations up to 150 (all tables and indexes, no functions)
for file in $(ls *.sql | sort -n | head -n 150); do
    psql -d your_database -f "$file"
done
```

### Verifying Migration Status
```sql
-- Check which tables exist
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Check which indexes exist
SELECT indexname FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY indexname;

-- Check which functions exist
SELECT proname FROM pg_proc 
WHERE pronamespace = 'public'::regnamespace 
ORDER BY proname;
```

## Rollback Strategy

Each migration has an implicit rollback:
- Tables: `DROP TABLE IF EXISTS table_name CASCADE;`
- Indexes: `DROP INDEX IF EXISTS index_name;`
- Functions: `DROP FUNCTION IF EXISTS function_name CASCADE;`
- Triggers: `DROP TRIGGER IF EXISTS trigger_name ON table_name;`

## Best Practices

### 1. **Comments**
Every table, column, index, and function should have a comment:
```sql
COMMENT ON TABLE feed_sources IS 'Configuration for all content feed sources';
COMMENT ON COLUMN feed_sources.id IS 'Unique identifier for the feed source';
```

### 2. **Constraints**
Name all constraints explicitly:
```sql
CONSTRAINT fk_raw_feeds_source_id FOREIGN KEY (source_id) REFERENCES feed_sources(id)
CONSTRAINT chk_feed_sources_type CHECK (type IN ('podcast', 'rss', ...))
CONSTRAINT uq_raw_feeds_source_external UNIQUE(source_id, external_id)
```

### 3. **Indexes**
Use partial indexes where appropriate:
```sql
CREATE INDEX idx_feed_sources_type_active 
ON feed_sources(type, is_active) 
WHERE is_active = true;
```

### 4. **Default Values**
Provide sensible defaults:
```sql
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
is_active BOOLEAN DEFAULT true
config JSONB DEFAULT '{}'
```

## Migration from Old Schema

To migrate from the old schema to this clean structure:

1. **Backup existing database**
   ```bash
   pg_dump -d old_database > backup.sql
   ```

2. **Create new database**
   ```bash
   createdb new_database
   ```

3. **Run new migrations**
   ```bash
   psql -d new_database -f run_all_migrations.sql
   ```

4. **Migrate data**
   ```bash
   psql -d new_database -f migrate_data.sql
   ```

5. **Verify migration**
   ```bash
   psql -d new_database -f verify_migration.sql
   ```

## Common Patterns

### Creating a Table with Foreign Keys
```sql
-- First create the parent table (e.g., 012_create_sectors_table.sql)
CREATE TABLE IF NOT EXISTS sectors (...);

-- Then create the child table (e.g., 032_create_industries_table.sql)
CREATE TABLE IF NOT EXISTS industries (
    sector_id UUID NOT NULL,
    CONSTRAINT fk_industries_sector_id 
        FOREIGN KEY (sector_id) 
        REFERENCES sectors(id)
);
```

### Creating Indexes
```sql
-- Create index in a separate file (e.g., 152_create_raw_feeds_indexes.sql)
CREATE INDEX IF NOT EXISTS idx_raw_feeds_source_published 
ON raw_feeds(source_id, published_at DESC);
```

### Creating Functions and Triggers
```sql
-- First create the function (e.g., 201_create_update_timestamp_function.sql)
CREATE OR REPLACE FUNCTION update_updated_at_column() ...

-- Then create triggers using it (e.g., 251_create_feed_sources_update_trigger.sql)
CREATE TRIGGER trg_feed_sources_updated_at
    BEFORE UPDATE ON feed_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## Troubleshooting

### Migration Fails
1. Check dependencies - ensure parent objects exist
2. Check for typos in table/column names
3. Verify extension is installed
4. Check user permissions

### Performance Issues
1. Ensure all foreign keys have indexes
2. Add indexes for common query patterns
3. Use partial indexes for filtered queries
4. Consider table partitioning for large tables

## Next Steps

1. Complete migration file generation for all tables
2. Create data migration scripts
3. Set up automated testing
4. Create rollback scripts
5. Document specific business logic

This refactored migration structure provides a solid foundation for database version control and deployment automation.