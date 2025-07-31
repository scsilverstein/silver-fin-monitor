#!/usr/bin/env python3
"""
Generate clean, single-responsibility migrations from existing schema.
Each migration does exactly ONE thing following proper dependency order.
"""

import os
from typing import List, Dict, Tuple

# Migration templates
EXTENSION_TEMPLATE = """-- {description}
-- {details}
CREATE EXTENSION IF NOT EXISTS "{extension}";"""

TABLE_TEMPLATE = """-- {description}
CREATE TABLE IF NOT EXISTS {table_name} (
{columns}
);

-- Add table comment
COMMENT ON TABLE {table_name} IS '{comment}';"""

INDEX_TEMPLATE = """-- {description}
CREATE INDEX IF NOT EXISTS {index_name} ON {table_name}{index_def};"""

FUNCTION_TEMPLATE = """-- {description}
CREATE OR REPLACE FUNCTION {function_name}
{function_body}"""

TRIGGER_TEMPLATE = """-- {description}
CREATE TRIGGER {trigger_name}
    {trigger_timing} {trigger_event} ON {table_name}
    FOR EACH ROW EXECUTE FUNCTION {function_name}();"""

# Migration definitions
MIGRATIONS = [
    # Extensions (001-010)
    {
        'number': '001',
        'name': 'enable_uuid_extension',
        'type': 'extension',
        'content': {
            'extension': 'uuid-ossp',
            'description': 'Enable UUID generation extension',
            'details': 'Required for primary key generation across all tables'
        }
    },
    {
        'number': '002',
        'name': 'enable_pgcrypto_extension',
        'type': 'extension',
        'content': {
            'extension': 'pgcrypto',
            'description': 'Enable cryptographic functions extension',
            'details': 'Required for secure random generation and hashing'
        }
    },
    {
        'number': '003',
        'name': 'enable_pgvector_extension',
        'type': 'extension',
        'content': {
            'extension': 'vector',
            'description': 'Enable vector similarity search extension',
            'details': 'Required for embeddings and semantic search'
        }
    },
    {
        'number': '004',
        'name': 'enable_pg_trgm_extension',
        'type': 'extension',
        'content': {
            'extension': 'pg_trgm',
            'description': 'Enable trigram similarity search extension',
            'details': 'Required for fuzzy text search and similarity matching'
        }
    },
    {
        'number': '005',
        'name': 'enable_btree_gist_extension',
        'type': 'extension',
        'content': {
            'extension': 'btree_gist',
            'description': 'Enable B-tree GiST extension',
            'details': 'Required for exclusion constraints with scalar types'
        }
    },
    
    # Base Tables (011-030)
    {
        'number': '011',
        'name': 'create_feed_sources_table',
        'type': 'table',
        'content': {
            'table_name': 'feed_sources',
            'description': 'Create feed sources configuration table',
            'comment': 'Configuration for all content feed sources (RSS, podcast, YouTube, API)',
            'columns': '''    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('podcast', 'rss', 'youtube', 'api', 'multi_source', 'reddit')),
    url TEXT NOT NULL,
    last_processed_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()'''
        }
    },
    {
        'number': '012',
        'name': 'create_sectors_table',
        'type': 'table',
        'content': {
            'table_name': 'sectors',
            'description': 'Create sectors lookup table',
            'comment': 'Market sectors for entity classification',
            'columns': '''    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sector_name VARCHAR(100) NOT NULL UNIQUE,
    sector_code VARCHAR(10) UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()'''
        }
    },
    {
        'number': '013',
        'name': 'create_cache_store_table',
        'type': 'table',
        'content': {
            'table_name': 'cache_store',
            'description': 'Create database cache store table',
            'comment': 'Simple key-value cache with TTL support',
            'columns': '''    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()'''
        }
    },
    {
        'number': '014',
        'name': 'create_job_queue_table',
        'type': 'table',
        'content': {
            'table_name': 'job_queue',
            'description': 'Create job queue table',
            'comment': 'Database-based job queue for background processing',
            'columns': '''    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type VARCHAR(100) NOT NULL,
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    payload JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retry')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()'''
        }
    },
    {
        'number': '015',
        'name': 'create_daily_analysis_table',
        'type': 'table',
        'content': {
            'table_name': 'daily_analysis',
            'description': 'Create daily market analysis table',
            'comment': 'AI-generated daily market analysis and insights',
            'columns': '''    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_date DATE NOT NULL,
    market_sentiment VARCHAR(50),
    key_themes TEXT[] DEFAULT '{}',
    overall_summary TEXT,
    ai_analysis JSONB DEFAULT '{}',
    confidence_score FLOAT CHECK (confidence_score BETWEEN 0 AND 1),
    sources_analyzed INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(analysis_date)'''
        }
    },
    {
        'number': '016',
        'name': 'create_kg_entity_types_table',
        'type': 'table',
        'content': {
            'table_name': 'kg_entity_types',
            'description': 'Create knowledge graph entity types table',
            'comment': 'Valid entity types and subtypes for knowledge graph',
            'columns': '''    entity_type VARCHAR(50) PRIMARY KEY,
    entity_subtype VARCHAR(50) NOT NULL,
    description TEXT,
    schema_version VARCHAR(10) DEFAULT '1.0',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(entity_type, entity_subtype)'''
        }
    },
    {
        'number': '017',
        'name': 'create_kg_relationship_types_table',
        'type': 'table',
        'content': {
            'table_name': 'kg_relationship_types',
            'description': 'Create knowledge graph relationship types table',
            'comment': 'Valid relationship types for knowledge graph',
            'columns': '''    predicate VARCHAR(100) PRIMARY KEY,
    inverse_predicate VARCHAR(100),
    relationship_category VARCHAR(50) NOT NULL,
    subject_types VARCHAR(50)[] NOT NULL,
    object_types VARCHAR(50)[] NOT NULL,
    description TEXT,
    is_symmetric BOOLEAN DEFAULT false,
    is_transitive BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()'''
        }
    }
]

def generate_migration(migration: Dict) -> str:
    """Generate migration content based on type."""
    if migration['type'] == 'extension':
        return EXTENSION_TEMPLATE.format(**migration['content'])
    elif migration['type'] == 'table':
        return TABLE_TEMPLATE.format(**migration['content'])
    elif migration['type'] == 'index':
        return INDEX_TEMPLATE.format(**migration['content'])
    elif migration['type'] == 'function':
        return FUNCTION_TEMPLATE.format(**migration['content'])
    elif migration['type'] == 'trigger':
        return TRIGGER_TEMPLATE.format(**migration['content'])
    else:
        return f"-- TODO: Implement {migration['type']} migration"

def main():
    """Generate all migration files."""
    output_dir = os.path.dirname(os.path.abspath(__file__))
    
    for migration in MIGRATIONS:
        filename = f"{migration['number']}_{migration['name']}.sql"
        filepath = os.path.join(output_dir, filename)
        
        # Skip if already exists
        if os.path.exists(filepath):
            print(f"Skipping {filename} - already exists")
            continue
            
        content = generate_migration(migration)
        
        with open(filepath, 'w') as f:
            f.write(content)
        
        print(f"Created {filename}")

if __name__ == '__main__':
    main()