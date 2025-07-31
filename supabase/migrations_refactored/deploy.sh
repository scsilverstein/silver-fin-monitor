#!/bin/bash
# Automated deployment script with safety checks

set -e

# Configuration
ENVIRONMENT="${1:-development}"
MIGRATIONS_DIR="$(dirname "$0")"
ROLLBACK_DIR="$MIGRATIONS_DIR/rollbacks"

# Load environment-specific config
source "$MIGRATIONS_DIR/config/$ENVIRONMENT.env" 2>/dev/null || true

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Silver Fin Monitor - Database Deployment${NC}"
echo -e "${BLUE}===========================================${NC}"
echo "Environment: $ENVIRONMENT"
echo "Database: $DB_NAME"
echo ""

# Safety checks
if [ "$ENVIRONMENT" == "production" ]; then
    echo -e "${YELLOW}⚠️  PRODUCTION DEPLOYMENT - Are you sure? (type 'yes' to continue)${NC}"
    read confirmation
    if [ "$confirmation" != "yes" ]; then
        echo "Deployment cancelled"
        exit 1
    fi
    
    # Backup production database
    echo "Creating backup..."
    BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
    PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE"
    echo -e "${GREEN}✅ Backup created: $BACKUP_FILE${NC}"
fi

# Check migration status
echo ""
echo "Checking migration status..."
PENDING_MIGRATIONS=$(ls -1 "$MIGRATIONS_DIR"/*.sql | grep -E '^[0-9]{3}_' | while read migration; do
    VERSION=$(basename "$migration" | cut -d'_' -f1)
    if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" \
        -tc "SELECT 1 FROM schema_migrations WHERE version = '$VERSION'" | grep -q 1; then
        echo "$migration"
    fi
done)

if [ -z "$PENDING_MIGRATIONS" ]; then
    echo -e "${GREEN}✅ All migrations are up to date${NC}"
    exit 0
fi

echo "Pending migrations:"
echo "$PENDING_MIGRATIONS" | while read migration; do
    echo "  - $(basename "$migration")"
done

# Dry run option
if [ "$2" == "--dry-run" ]; then
    echo ""
    echo -e "${YELLOW}DRY RUN - No changes will be made${NC}"
    exit 0
fi

# Apply migrations
echo ""
echo "Applying migrations..."

# Create migration tracking table if needed
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" \
    -f "$MIGRATIONS_DIR/000_create_migration_tracking.sql" 2>/dev/null || true

# Apply each pending migration
echo "$PENDING_MIGRATIONS" | while read migration; do
    if [ -z "$migration" ]; then continue; fi
    
    VERSION=$(basename "$migration" | cut -d'_' -f1)
    NAME=$(basename "$migration")
    
    echo -n "Applying $NAME... "
    
    START_TIME=$(date +%s%N)
    
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" \
        -f "$migration" -v ON_ERROR_STOP=1 2>&1 | tee /tmp/migration_output.log > /dev/null; then
        
        END_TIME=$(date +%s%N)
        DURATION=$((($END_TIME - $START_TIME) / 1000000))
        
        # Record successful migration
        CHECKSUM=$(sha256sum "$migration" | cut -d' ' -f1)
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "
            INSERT INTO schema_migrations (version, name, execution_time_ms, checksum, success)
            VALUES ('$VERSION', '$NAME', $DURATION, '$CHECKSUM', true)
        " > /dev/null
        
        echo -e "${GREEN}✅ ($DURATION ms)${NC}"
    else
        # Record failed migration
        ERROR=$(cat /tmp/migration_output.log | tr '\n' ' ' | cut -c1-500)
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "
            INSERT INTO schema_migrations (version, name, success, error_message)
            VALUES ('$VERSION', '$NAME', false, '$ERROR')
        " > /dev/null 2>&1 || true
        
        echo -e "${RED}❌ FAILED${NC}"
        echo "Error output:"
        cat /tmp/migration_output.log
        
        # Rollback option
        echo ""
        echo -e "${YELLOW}Migration failed. Rollback? (y/N)${NC}"
        read -n 1 rollback_choice
        if [ "$rollback_choice" == "y" ]; then
            ROLLBACK_FILE="$ROLLBACK_DIR/down_$NAME"
            if [ -f "$ROLLBACK_FILE" ]; then
                echo "Rolling back..."
                PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f "$ROLLBACK_FILE"
            fi
        fi
        
        exit 1
    fi
done

# Verify deployment
echo ""
echo "Running verification..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" \
    -f "$MIGRATIONS_DIR/verify_schema.sql" > /tmp/verification.log 2>&1

if grep -q "MISSING" /tmp/verification.log; then
    echo -e "${YELLOW}⚠️  Some issues detected:${NC}"
    grep "MISSING" /tmp/verification.log
else
    echo -e "${GREEN}✅ Schema verification passed${NC}"
fi

# Final summary
echo ""
echo -e "${BLUE}===========================================${NC}"
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "Migration summary:"
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "
    SELECT 
        COUNT(*) as total_migrations,
        COUNT(*) FILTER (WHERE success = true) as successful,
        COUNT(*) FILTER (WHERE success = false) as failed
    FROM schema_migrations
"

# Cleanup
rm -f /tmp/migration_output.log /tmp/verification.log

echo ""
echo "Next steps:"
echo "  1. Test the application"
echo "  2. Monitor for errors"
if [ "$ENVIRONMENT" == "production" ]; then
    echo "  3. Keep backup for at least 7 days: $BACKUP_FILE"
fi