-- Create knowledge graph functions
-- Functions for graph operations and analysis

-- Function to find connected entities (breadth-first search)
CREATE OR REPLACE FUNCTION find_connected_entities(
    start_entity_id UUID,
    max_depth INTEGER DEFAULT 3,
    relationship_types VARCHAR[] DEFAULT NULL
) RETURNS TABLE (
    entity_id UUID,
    entity_name VARCHAR(255),
    entity_type VARCHAR(50),
    path_length INTEGER,
    relationship_path TEXT[]
) AS $$
DECLARE
    current_depth INTEGER := 0;
    new_entities_found BOOLEAN := TRUE;
BEGIN
    -- Create temporary table for BFS traversal
    CREATE TEMP TABLE IF NOT EXISTS entity_paths (
        entity_id UUID,
        depth INTEGER,
        path TEXT[],
        PRIMARY KEY (entity_id, depth)
    );
    
    -- Start with the initial entity
    INSERT INTO entity_paths (entity_id, depth, path) 
    VALUES (start_entity_id, 0, ARRAY[]::TEXT[]);
    
    -- BFS traversal
    WHILE current_depth < max_depth AND new_entities_found LOOP
        new_entities_found := FALSE;
        current_depth := current_depth + 1;
        
        -- Find next level of connected entities
        INSERT INTO entity_paths (entity_id, depth, path)
        SELECT DISTINCT
            r.target_entity_id,
            current_depth,
            ep.path || r.relationship_type
        FROM entity_paths ep
        JOIN kg_relationships r ON r.source_entity_id = ep.entity_id
        WHERE ep.depth = current_depth - 1
        AND (relationship_types IS NULL OR r.relationship_type = ANY(relationship_types))
        AND r.target_entity_id NOT IN (
            SELECT entity_id FROM entity_paths
        )
        ON CONFLICT DO NOTHING;
        
        -- Check if any new entities were found
        IF FOUND THEN
            new_entities_found := TRUE;
        END IF;
    END LOOP;
    
    -- Return results with entity details
    RETURN QUERY
    SELECT 
        e.id,
        e.name,
        e.entity_type,
        ep.depth,
        ep.path
    FROM entity_paths ep
    JOIN kg_entities e ON e.id = ep.entity_id
    WHERE ep.entity_id != start_entity_id
    ORDER BY ep.depth, e.name;
    
    -- Cleanup
    DROP TABLE IF EXISTS entity_paths;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate entity importance (PageRank-like)
CREATE OR REPLACE FUNCTION calculate_entity_importance(
    entity_type_filter VARCHAR(50) DEFAULT NULL,
    damping_factor DECIMAL DEFAULT 0.85,
    max_iterations INTEGER DEFAULT 50
) RETURNS TABLE (
    entity_id UUID,
    importance_score DECIMAL(10, 6)
) AS $$
DECLARE
    iteration INTEGER := 0;
    convergence_threshold DECIMAL := 0.0001;
    max_change DECIMAL := 1.0;
BEGIN
    -- Create temporary table for PageRank calculation
    CREATE TEMP TABLE entity_importance (
        entity_id UUID PRIMARY KEY,
        old_score DECIMAL(10, 6) DEFAULT 1.0,
        new_score DECIMAL(10, 6) DEFAULT 1.0,
        out_degree INTEGER DEFAULT 0
    );
    
    -- Initialize with entities and their out-degrees
    INSERT INTO entity_importance (entity_id, out_degree)
    SELECT 
        e.id,
        COALESCE(out_counts.out_degree, 0)
    FROM kg_entities e
    LEFT JOIN (
        SELECT 
            source_entity_id,
            COUNT(*) as out_degree
        FROM kg_relationships
        GROUP BY source_entity_id
    ) out_counts ON out_counts.source_entity_id = e.id
    WHERE entity_type_filter IS NULL OR e.entity_type = entity_type_filter;
    
    -- PageRank iterations
    WHILE iteration < max_iterations AND max_change > convergence_threshold LOOP
        -- Calculate new scores
        UPDATE entity_importance ei
        SET new_score = (1 - damping_factor) + damping_factor * COALESCE(
            (SELECT SUM(ei2.old_score / GREATEST(ei2.out_degree, 1))
             FROM entity_importance ei2
             JOIN kg_relationships r ON r.source_entity_id = ei2.entity_id
             WHERE r.target_entity_id = ei.entity_id), 0
        );
        
        -- Calculate convergence
        SELECT MAX(ABS(new_score - old_score)) INTO max_change
        FROM entity_importance;
        
        -- Update old scores
        UPDATE entity_importance SET old_score = new_score;
        
        iteration := iteration + 1;
    END LOOP;
    
    -- Return results
    RETURN QUERY
    SELECT ei.entity_id, ei.new_score
    FROM entity_importance ei
    ORDER BY ei.new_score DESC;
    
    -- Cleanup
    DROP TABLE entity_importance;
END;
$$ LANGUAGE plpgsql;

-- Function to find entity clusters using simple community detection
CREATE OR REPLACE FUNCTION detect_entity_communities(
    min_cluster_size INTEGER DEFAULT 5,
    similarity_threshold DECIMAL DEFAULT 0.5
) RETURNS TABLE (
    cluster_id INTEGER,
    entity_id UUID,
    entity_name VARCHAR(255),
    cluster_score DECIMAL(5, 2)
) AS $$
DECLARE
    cluster_counter INTEGER := 1;
BEGIN
    -- Create temporary table for clustering
    CREATE TEMP TABLE entity_clusters (
        entity_id UUID PRIMARY KEY,
        cluster_id INTEGER,
        processed BOOLEAN DEFAULT FALSE
    );
    
    -- Initialize with all entities
    INSERT INTO entity_clusters (entity_id)
    SELECT id FROM kg_entities;
    
    -- Simple clustering based on shared relationships
    FOR entity_record IN (
        SELECT entity_id FROM entity_clusters WHERE NOT processed ORDER BY entity_id
    ) LOOP
        IF NOT EXISTS (SELECT 1 FROM entity_clusters WHERE entity_id = entity_record.entity_id AND cluster_id IS NOT NULL) THEN
            -- Start new cluster
            UPDATE entity_clusters 
            SET cluster_id = cluster_counter, processed = TRUE
            WHERE entity_id = entity_record.entity_id;
            
            -- Add connected entities to cluster
            WITH connected_entities AS (
                SELECT DISTINCT r.target_entity_id as connected_id
                FROM kg_relationships r
                WHERE r.source_entity_id = entity_record.entity_id
                AND r.strength > similarity_threshold
                UNION
                SELECT DISTINCT r.source_entity_id as connected_id
                FROM kg_relationships r
                WHERE r.target_entity_id = entity_record.entity_id
                AND r.strength > similarity_threshold
            )
            UPDATE entity_clusters ec
            SET cluster_id = cluster_counter, processed = TRUE
            WHERE ec.entity_id IN (SELECT connected_id FROM connected_entities)
            AND ec.cluster_id IS NULL;
            
            cluster_counter := cluster_counter + 1;
        END IF;
    END LOOP;
    
    -- Return results for clusters meeting minimum size
    RETURN QUERY
    SELECT 
        ec.cluster_id,
        e.id,
        e.name,
        AVG(r.strength)::DECIMAL(5, 2) as cluster_score
    FROM entity_clusters ec
    JOIN kg_entities e ON e.id = ec.entity_id
    LEFT JOIN kg_relationships r ON (r.source_entity_id = ec.entity_id OR r.target_entity_id = ec.entity_id)
    WHERE ec.cluster_id IN (
        SELECT cluster_id 
        FROM entity_clusters 
        WHERE cluster_id IS NOT NULL
        GROUP BY cluster_id 
        HAVING COUNT(*) >= min_cluster_size
    )
    GROUP BY ec.cluster_id, e.id, e.name
    ORDER BY ec.cluster_id, cluster_score DESC;
    
    -- Cleanup
    DROP TABLE entity_clusters;
END;
$$ LANGUAGE plpgsql;

-- Function to find shortest path between entities
CREATE OR REPLACE FUNCTION find_shortest_path(
    start_entity UUID,
    end_entity UUID,
    max_hops INTEGER DEFAULT 6
) RETURNS TABLE (
    hop_number INTEGER,
    entity_id UUID,
    entity_name VARCHAR(255),
    relationship_type VARCHAR(100),
    relationship_strength DECIMAL(5, 2)
) AS $$
BEGIN
    WITH RECURSIVE path_search AS (
        -- Base case: start entity
        SELECT 
            0 as hop,
            start_entity as entity_id,
            ARRAY[start_entity] as path,
            ''::VARCHAR(100) as rel_type,
            0::DECIMAL(5, 2) as strength
        
        UNION ALL
        
        -- Recursive case: extend path
        SELECT 
            ps.hop + 1,
            r.target_entity_id,
            ps.path || r.target_entity_id,
            r.relationship_type,
            r.strength
        FROM path_search ps
        JOIN kg_relationships r ON r.source_entity_id = ps.entity_id
        WHERE ps.hop < max_hops
        AND r.target_entity_id != ALL(ps.path)  -- Avoid cycles
        AND NOT EXISTS (
            SELECT 1 FROM path_search ps2 
            WHERE ps2.entity_id = r.target_entity_id 
            AND ps2.hop <= ps.hop
        )
    )
    SELECT 
        ps.hop,
        ps.entity_id,
        e.name,
        ps.rel_type,
        ps.strength
    FROM path_search ps
    JOIN kg_entities e ON e.id = ps.entity_id
    WHERE ps.entity_id = end_entity
    ORDER BY ps.hop
    LIMIT 1;  -- Return only the shortest path
END;
$$ LANGUAGE plpgsql;

-- Function to get entity neighborhood
CREATE OR REPLACE FUNCTION get_entity_neighborhood(
    center_entity UUID,
    radius INTEGER DEFAULT 2
) RETURNS TABLE (
    entity_id UUID,
    entity_name VARCHAR(255),
    entity_type VARCHAR(50),
    distance INTEGER,
    connection_strength DECIMAL(5, 2)
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE neighborhood AS (
        -- Start with center entity
        SELECT 
            center_entity as id,
            0 as dist,
            1.0::DECIMAL(5, 2) as strength
        
        UNION ALL
        
        -- Expand neighborhood
        SELECT 
            r.target_entity_id,
            n.dist + 1,
            LEAST(n.strength, r.strength)
        FROM neighborhood n
        JOIN kg_relationships r ON r.source_entity_id = n.id
        WHERE n.dist < radius
    )
    SELECT DISTINCT
        e.id,
        e.name,
        e.entity_type,
        n.dist,
        MAX(n.strength) as max_strength
    FROM neighborhood n
    JOIN kg_entities e ON e.id = n.id
    WHERE n.id != center_entity
    GROUP BY e.id, e.name, e.entity_type, n.dist
    ORDER BY n.dist, max_strength DESC;
END;
$$ LANGUAGE plpgsql;

-- Add function comments
COMMENT ON FUNCTION find_connected_entities IS 'Find entities connected through relationships using BFS';
COMMENT ON FUNCTION calculate_entity_importance IS 'Calculate entity importance using PageRank algorithm';
COMMENT ON FUNCTION detect_entity_communities IS 'Detect entity communities using relationship clustering';
COMMENT ON FUNCTION find_shortest_path IS 'Find shortest path between two entities';
COMMENT ON FUNCTION get_entity_neighborhood IS 'Get entities within specified distance from center entity';