# Silver Fin Monitor - Archived Code

This directory contains archived code, scripts, and files that are no longer actively used in the main application but are kept for reference.

## Directory Structure

### `/root-scripts/`
**Root-level debugging and temporary scripts** that were cluttering the project root:
- `api-auto-process-integration.ts` - API integration tests
- `debug-*.js` - Debugging utilities
- `create-test-*.js` - Test data creation scripts
- `fix-*.ts` - One-time fix scripts
- `investigate-*.ts` - Investigation and analysis scripts
- `temp-*.js` - Temporary experimental code

### `/debugging-scripts/`
**Development and debugging scripts** from the `/scripts/` directory:
- `test-*.ts` - Test scripts for queue system, workers, etc.
- `check-*.ts` - System verification and health check scripts
- `fix-*.ts` - One-time repair scripts
- `cleanup-*.ts` - Data cleanup and maintenance scripts
- `analyze-*.ts` - Analysis and investigation scripts
- `backfill-*.ts` - Historical data backfill scripts

### `/old-migration-scripts/`
**Database migration scripts** that are no longer needed:
- SQL migration files
- Schema update scripts
- Data transformation scripts

### `/dist-files/`
**Compiled TypeScript output** (build artifacts):
- `dist/` directory with `.d.ts` files and compiled JavaScript
- Should be regenerated from source, not committed

### `/unused-configs/`
**Configuration files** that are no longer in use:
- Old configuration formats
- Deprecated service configurations
- Legacy environment setups

## Why These Files Were Archived

1. **Cluttered Development**: Too many temporary scripts in root directory made navigation confusing
2. **Development Complexity**: Outdated debugging scripts created confusion about current system state
3. **Performance**: Reduced file count in main directories for faster IDE navigation
4. **Maintenance**: Separated active code from legacy/debugging code

## What Remains Active

After archiving, the main project structure contains only:

### **Core Application Files**:
- `/src/` - Main application source code
- `/frontend/` - React frontend application
- `/netlify/functions/` - Production Netlify Functions
- `/scripts/` - Essential production and deployment scripts only

### **Essential Scripts** (kept in `/scripts/`):
- `force-analysis-generation.ts` - Production analysis triggering
- `check-queue-status.ts` - Production monitoring
- `setup-*.ts` - Environment setup scripts
- `seed-*.ts` - Database seeding scripts

### **Configuration Files**:
- `package.json` - Cleaned up with only active scripts
- `tsconfig.json` - TypeScript configuration
- `.env.example` - Environment template
- `CLAUDE.md` - Project specification

## Recovery Instructions

If you need to restore any archived files:

1. **Copy back to original location**: `cp archive/category/filename.ts ./`
2. **Check dependencies**: Ensure any imports/references still exist
3. **Update if needed**: May require updates for current codebase

## Safe to Delete

The archived files can be safely deleted if you're confident they won't be needed for reference. They are not part of the active application and don't affect production functionality.

## Archive Date

Files archived on: **August 5, 2025**
Archived by: **Claude Code Assistant**
Reason: **Codebase cleanup and organization improvement**