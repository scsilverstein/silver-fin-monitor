-- Create knowledge graph entity clusters table
CREATE TABLE IF NOT EXISTS kg_entity_clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_name VARCHAR(255) NOT NULL,
    cluster_type VARCHAR(50) NOT NULL,
    algorithm VARCHAR(100),
    parameters JSONB DEFAULT '{}',
    entity_ids UUID[] NOT NULL,
    cluster_center UUID,
    cluster_metrics JSONB DEFAULT '{}',
    parent_cluster_id UUID,
    hierarchy_level INTEGER DEFAULT 0,
    color_hex VARCHAR(7),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_kg_entity_clusters_parent 
        FOREIGN KEY (parent_cluster_id) 
        REFERENCES kg_entity_clusters(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT chk_kg_entity_clusters_type CHECK (
        cluster_type IN ('community', 'sector', 'topic', 'geographic')
    ),
    
    CONSTRAINT chk_kg_entity_clusters_algorithm CHECK (
        algorithm IS NULL OR 
        algorithm IN ('louvain', 'kmeans', 'hierarchical', 'dbscan')
    ),
    
    CONSTRAINT chk_kg_entity_clusters_color CHECK (
        color_hex IS NULL OR color_hex ~ '^#[0-9A-Fa-f]{6}$'
    ),
    
    CONSTRAINT chk_kg_entity_clusters_hierarchy CHECK (
        hierarchy_level >= 0
    )
);

-- Add table comment
COMMENT ON TABLE kg_entity_clusters IS 'Entity clustering for graph visualization';

-- Add column comments
COMMENT ON COLUMN kg_entity_clusters.cluster_type IS 'Type of cluster: community, sector, topic, geographic';
COMMENT ON COLUMN kg_entity_clusters.algorithm IS 'Clustering algorithm used: louvain, kmeans, hierarchical, dbscan';
COMMENT ON COLUMN kg_entity_clusters.parameters IS 'Algorithm parameters used';
COMMENT ON COLUMN kg_entity_clusters.cluster_center IS 'Central entity in the cluster';
COMMENT ON COLUMN kg_entity_clusters.cluster_metrics IS 'Metrics like {density, cohesion, separation, silhouette}';
COMMENT ON COLUMN kg_entity_clusters.hierarchy_level IS 'Level in cluster hierarchy (0 = root)';