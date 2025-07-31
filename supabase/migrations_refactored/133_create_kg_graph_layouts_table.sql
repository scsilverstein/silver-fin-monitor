-- Create knowledge graph layouts table
CREATE TABLE IF NOT EXISTS kg_graph_layouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    layout_name VARCHAR(255) NOT NULL,
    layout_type VARCHAR(50) NOT NULL,
    entity_positions JSONB DEFAULT '{}',
    edge_styles JSONB DEFAULT '{}',
    zoom_level DECIMAL(5,2) DEFAULT 1.0,
    center_point JSONB DEFAULT '{"x": 0, "y": 0}',
    filters JSONB DEFAULT '{}',
    camera_position JSONB DEFAULT '{}',
    created_by UUID,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_kg_graph_layouts_type CHECK (
        layout_type IN ('force-directed', 'hierarchical', 'circular', 'geographic')
    ),
    
    CONSTRAINT chk_kg_graph_layouts_zoom CHECK (
        zoom_level > 0 AND zoom_level <= 100
    )
);

-- Add table comment
COMMENT ON TABLE kg_graph_layouts IS 'Store graph layouts and visual configurations';

-- Add column comments
COMMENT ON COLUMN kg_graph_layouts.layout_type IS 'Type of layout: force-directed, hierarchical, circular, geographic';
COMMENT ON COLUMN kg_graph_layouts.entity_positions IS 'Positions of entities {entity_id: {x, y, z, fixed, color, size}}';
COMMENT ON COLUMN kg_graph_layouts.edge_styles IS 'Styles for edges {relationship_type: {color, width, style}}';
COMMENT ON COLUMN kg_graph_layouts.zoom_level IS 'Current zoom level (1.0 = 100%)';
COMMENT ON COLUMN kg_graph_layouts.filters IS 'Active filters for this view';
COMMENT ON COLUMN kg_graph_layouts.camera_position IS 'Camera position for 3D views';