#!/bin/bash
# Run all migrations in order

set -e  # Exit on error

# Configuration
DB_NAME="${DB_NAME:-silver_fin_monitor}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🚀 Silver Fin Monitor - Database Migration Runner"
echo "================================================"
echo "Database: $DB_NAME"
echo "Host: $DB_HOST:$DB_PORT"
echo ""

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ psql command not found. Please install PostgreSQL client.${NC}"
    exit 1
fi

# Test database connection
echo "Testing database connection..."
if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" &> /dev/null; then
    echo -e "${RED}❌ Cannot connect to database. Please check your credentials.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Database connection successful${NC}"
echo ""

# Count migrations
TOTAL_MIGRATIONS=$(ls -1 *.sql 2>/dev/null | grep -E '^[0-9]{3}_' | wc -l)
if [ "$TOTAL_MIGRATIONS" -eq 0 ]; then
    echo -e "${RED}❌ No migration files found in current directory${NC}"
    exit 1
fi

echo "Found $TOTAL_MIGRATIONS migration files to run"
echo ""

# Run migrations
CURRENT=0
FAILED=0

for migration in $(ls -1 *.sql | grep -E '^[0-9]{3}_' | sort -n); do
    CURRENT=$((CURRENT + 1))
    echo -n "[$CURRENT/$TOTAL_MIGRATIONS] Running $migration... "
    
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$migration" &> /tmp/migration_error.log; then
        echo -e "${GREEN}✅${NC}"
    else
        echo -e "${RED}❌ FAILED${NC}"
        echo -e "${RED}Error output:${NC}"
        cat /tmp/migration_error.log
        FAILED=$((FAILED + 1))
        
        # Ask if should continue
        read -p "Continue with remaining migrations? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
done

echo ""
echo "================================================"
if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}✅ All migrations completed successfully!${NC}"
else
    echo -e "${YELLOW}⚠️  Completed with $FAILED failures${NC}"
fi

# Show final schema status
echo ""
echo "Current schema status:"
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
SELECT 
    COUNT(*) FILTER (WHERE table_type = 'BASE TABLE') as tables,
    COUNT(*) FILTER (WHERE table_type = 'VIEW') as views
FROM information_schema.tables 
WHERE table_schema = 'public';
"

PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
SELECT COUNT(*) as indexes
FROM pg_indexes 
WHERE schemaname = 'public';
"

PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
SELECT COUNT(*) as functions
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public';
"