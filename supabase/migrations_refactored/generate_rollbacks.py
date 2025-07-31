#!/usr/bin/env python3
"""
Generate rollback scripts for all migrations.
Each rollback undoes exactly what the migration did.
"""

import os
import re
from typing import Tuple, Optional

def extract_object_info(sql_content: str) -> Tuple[str, str, Optional[str]]:
    """Extract object type, name, and dependent object from SQL."""
    
    # Extensions
    if 'CREATE EXTENSION' in sql_content:
        match = re.search(r'CREATE EXTENSION IF NOT EXISTS "?([^";\s]+)"?', sql_content)
        if match:
            return 'EXTENSION', match.group(1), None
    
    # Tables
    if 'CREATE TABLE' in sql_content:
        match = re.search(r'CREATE TABLE IF NOT EXISTS (\w+)', sql_content)
        if match:
            return 'TABLE', match.group(1), None
    
    # Indexes
    if 'CREATE INDEX' in sql_content:
        match = re.search(r'CREATE INDEX IF NOT EXISTS (\w+)', sql_content)
        if match:
            return 'INDEX', match.group(1), None
    
    # Functions
    if 'CREATE OR REPLACE FUNCTION' in sql_content or 'CREATE FUNCTION' in sql_content:
        match = re.search(r'CREATE (?:OR REPLACE )?FUNCTION (\w+)', sql_content)
        if match:
            return 'FUNCTION', match.group(1), None
    
    # Triggers
    if 'CREATE TRIGGER' in sql_content:
        match = re.search(r'CREATE TRIGGER (\w+).*ON (\w+)', sql_content, re.DOTALL)
        if match:
            return 'TRIGGER', match.group(1), match.group(2)
    
    # Views
    if 'CREATE VIEW' in sql_content or 'CREATE MATERIALIZED VIEW' in sql_content:
        match = re.search(r'CREATE (?:MATERIALIZED )?VIEW (?:IF NOT EXISTS )?(\w+)', sql_content)
        if match:
            view_type = 'MATERIALIZED VIEW' if 'MATERIALIZED' in sql_content else 'VIEW'
            return view_type, match.group(1), None
    
    # Seeds (INSERT)
    if 'INSERT INTO' in sql_content:
        match = re.search(r'INSERT INTO (\w+)', sql_content)
        if match:
            return 'SEED', match.group(1), None
    
    return 'UNKNOWN', 'unknown', None

def generate_rollback(obj_type: str, obj_name: str, dependent: Optional[str] = None) -> str:
    """Generate rollback SQL for a given object."""
    
    rollback_templates = {
        'EXTENSION': 'DROP EXTENSION IF EXISTS "{}" CASCADE;',
        'TABLE': 'DROP TABLE IF EXISTS {} CASCADE;',
        'INDEX': 'DROP INDEX IF EXISTS {};',
        'FUNCTION': 'DROP FUNCTION IF EXISTS {} CASCADE;',
        'TRIGGER': 'DROP TRIGGER IF EXISTS {} ON {};',
        'VIEW': 'DROP VIEW IF EXISTS {} CASCADE;',
        'MATERIALIZED VIEW': 'DROP MATERIALIZED VIEW IF EXISTS {} CASCADE;',
        'SEED': '-- Manual rollback required for seed data in table {}'
    }
    
    if obj_type == 'TRIGGER' and dependent:
        return rollback_templates[obj_type].format(obj_name, dependent)
    elif obj_type in rollback_templates:
        return rollback_templates[obj_type].format(obj_name)
    else:
        return f'-- TODO: Manual rollback required for {obj_type} {obj_name}'

def main():
    """Generate rollback files for all migrations."""
    
    # Create rollbacks directory
    rollback_dir = 'rollbacks'
    os.makedirs(rollback_dir, exist_ok=True)
    
    # Process all migration files
    migration_files = [f for f in os.listdir('.') if f.endswith('.sql') and re.match(r'^\d{3}_', f)]
    migration_files.sort(reverse=True)  # Process in reverse order for dependencies
    
    print(f"Generating rollback scripts for {len(migration_files)} migrations...")
    
    for migration_file in migration_files:
        # Read migration content
        with open(migration_file, 'r') as f:
            content = f.read()
        
        # Extract object info
        obj_type, obj_name, dependent = extract_object_info(content)
        
        # Generate rollback
        rollback_sql = generate_rollback(obj_type, obj_name, dependent)
        
        # Extract description from first comment
        desc_match = re.search(r'^-- (.+)$', content, re.MULTILINE)
        description = desc_match.group(1) if desc_match else f"Rollback {migration_file}"
        
        # Create rollback file
        rollback_file = os.path.join(rollback_dir, f"down_{migration_file}")
        with open(rollback_file, 'w') as f:
            f.write(f"-- Rollback: {description}\n")
            f.write(rollback_sql)
            if obj_type == 'TABLE':
                f.write(f"\n\n-- Note: This will cascade delete all dependent objects")
            f.write("\n")
        
        print(f"Created {rollback_file} ({obj_type} {obj_name})")
    
    # Create master rollback script
    with open(os.path.join(rollback_dir, 'rollback_all.sql'), 'w') as f:
        f.write("-- Complete rollback of all migrations\n")
        f.write("-- Run this to completely remove the schema\n\n")
        f.write("BEGIN;\n\n")
        
        for migration_file in migration_files:
            f.write(f"\\i {migration_file}\n")
        
        f.write("\nCOMMIT;\n")
    
    print(f"\n✅ Generated {len(migration_files)} rollback scripts in {rollback_dir}/")
    print("   Run rollback_all.sql to completely remove the schema")

if __name__ == '__main__':
    main()