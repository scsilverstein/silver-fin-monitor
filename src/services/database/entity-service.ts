import { db } from './index';

// Define types directly since Database might not have these properties
type Entity = any;
type FundamentalMetrics = any;
type MarketDataDaily = any;
type DailyAnalytics = any;
type EarningsEvent = any;

export interface EntityComplete {
  entity: Entity & {
    sector_name?: string;
    industry_name?: string;
  };
  metrics?: FundamentalMetrics;
  marketData?: MarketDataDaily;
  analytics?: DailyAnalytics;
  nextEarnings?: EarningsEvent;
}

export class EntityService {
  /**
   * Get complete entity information including all related data
   */
  static async getEntityComplete(symbol: string): Promise<EntityComplete | null> {
    try {
      // Get entity with classification
      const client = (db as any).getClient();
      const { data: entityData, error: entityError } = await client
        .from('entities')
        .select(`
          *,
          entity_classifications!inner (
            industries!inner (
              industry_name,
              sectors!inner (
                sector_name
              )
            )
          )
        `)
        .eq('symbol', symbol)
        .eq('entity_classifications.classification_type', 'primary')
        .single();

      if (entityError) throw entityError;
      if (!entityData) return null;

      // Get latest fundamental metrics
      const { data: metrics } = await client
        .from('fundamental_metrics')
        .select('*')
        .eq('entity_id', entityData.id)
        .order('metric_date', { ascending: false })
        .limit(1)
        .single();

      // Get latest market data
      const { data: marketData } = await client
        .from('market_data_daily')
        .select('*')
        .eq('entity_id', entityData.id)
        .order('market_date', { ascending: false })
        .limit(1)
        .single();

      // Get latest analytics
      const { data: analytics } = await client
        .from('daily_analytics')
        .select('*')
        .eq('entity_id', entityData.id)
        .order('analytics_date', { ascending: false })
        .limit(1)
        .single();

      // Get next earnings
      const { data: nextEarnings } = await client
        .from('earnings_events')
        .select('*')
        .eq('entity_id', entityData.id)
        .eq('has_reported', false)
        .gte('earnings_date', new Date().toISOString().split('T')[0])
        .order('earnings_date', { ascending: true })
        .limit(1)
        .single();

      // Flatten the nested structure
      const entity = {
        ...entityData,
        sector_name: entityData.entity_classifications?.[0]?.industries?.sectors?.sector_name,
        industry_name: entityData.entity_classifications?.[0]?.industries?.industry_name
      };

      // Remove the nested classification data
      delete entity.entity_classifications;

      return {
        entity,
        metrics: metrics || undefined,
        marketData: marketData || undefined,
        analytics: analytics || undefined,
        nextEarnings: nextEarnings || undefined
      };
    } catch (error) {
      console.error('Error fetching entity complete:', error);
      return null;
    }
  }

  /**
   * Get all active entities with basic information
   */
  static async getActiveEntities() {
    const client = (db as any).getClient();
    const { data, error } = await client
      .from('entities')
      .select(`
        id,
        symbol,
        name,
        primary_exchange,
        entity_classifications!inner (
          industries!inner (
            industry_name,
            sectors!inner (
              sector_name
            )
          )
        )
      `)
      .eq('is_active', true)
      .eq('entity_classifications.classification_type', 'primary')
      .order('symbol');

    if (error) throw error;

    // Flatten the structure
    return data?.map(entity => ({
      id: entity.id,
      symbol: entity.symbol,
      name: entity.name,
      primary_exchange: entity.primary_exchange,
      sector_name: entity.entity_classifications?.[0]?.industries?.sectors?.sector_name,
      industry_name: entity.entity_classifications?.[0]?.industries?.industry_name
    })) || [];
  }

  /**
   * Search entities by symbol or name
   */
  static async searchEntities(query: string) {
    const client = (db as any).getClient();
    const { data, error } = await client
      .from('entities')
      .select('id, symbol, name, primary_exchange')
      .or(`symbol.ilike.%${query}%,name.ilike.%${query}%`)
      .eq('is_active', true)
      .order('symbol');

    if (error) throw error;
    return data || [];
  }

  /**
   * Get entity by ID
   */
  static async getEntityById(id: string): Promise<Entity | null> {
    const client = (db as any).getClient();
    const { data, error } = await client
      .from('entities')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get entities by sector
   */
  static async getEntitiesBySector(sectorName: string) {
    const client = (db as any).getClient();
    const { data, error } = await client
      .from('entities')
      .select(`
        id,
        symbol,
        name,
        entity_classifications!inner (
          industries!inner (
            sectors!inner (
              sector_name
            )
          )
        )
      `)
      .eq('is_active', true)
      .eq('entity_classifications.classification_type', 'primary')
      .eq('entity_classifications.industries.sectors.sector_name', sectorName)
      .order('symbol');

    if (error) throw error;

    return data?.map(entity => ({
      id: entity.id,
      symbol: entity.symbol,
      name: entity.name
    })) || [];
  }

  /**
   * Get peer entities for comparison
   */
  static async getPeerEntities(entityId: string) {
    const client = (db as any).getClient();
    // First get the entity's industry
    const { data: entityData } = await client
      .from('entity_classifications')
      .select('industry_id')
      .eq('entity_id', entityId)
      .eq('classification_type', 'primary')
      .single();

    if (!entityData?.industry_id) return [];

    // Get other entities in the same industry
    const { data, error } = await client
      .from('entities')
      .select(`
        id,
        symbol,
        name,
        entity_classifications!inner (
          industry_id
        )
      `)
      .eq('is_active', true)
      .eq('entity_classifications.industry_id', entityData.industry_id)
      .neq('id', entityId)
      .order('symbol');

    if (error) throw error;

    return data?.map(entity => ({
      id: entity.id,
      symbol: entity.symbol,
      name: entity.name
    })) || [];
  }
}

// Helper function to transform old API responses to new format
export function transformLegacyStockData(oldData: any): EntityComplete {
  return {
    entity: {
      id: oldData.id,
      symbol: oldData.symbol,
      name: oldData.name,
      primary_exchange: oldData.exchange,
      sector_name: oldData.sector,
      industry_name: oldData.industry,
      is_active: true,
      created_at: oldData.created_at,
      updated_at: oldData.last_updated
    } as Entity & { sector_name?: string; industry_name?: string },
    metrics: oldData.fundamentals ? {
      id: oldData.fundamentals.id,
      entity_id: oldData.id,
      metric_date: oldData.fundamentals.data_date,
      pe_ratio: oldData.fundamentals.pe_ratio,
      forward_pe_ratio: oldData.fundamentals.forward_pe_ratio,
      market_cap: oldData.fundamentals.market_cap,
      beta: oldData.fundamentals.roe, // Note: This is a mapping issue in old schema
      data_source: oldData.fundamentals.data_source,
      created_at: oldData.fundamentals.created_at
    } as FundamentalMetrics : undefined,
    marketData: oldData.fundamentals?.price ? {
      id: crypto.randomUUID(),
      entity_id: oldData.id,
      market_date: oldData.fundamentals.data_date,
      close_price: oldData.fundamentals.price,
      volume: oldData.fundamentals.volume,
      data_source: oldData.fundamentals.data_source,
      created_at: oldData.fundamentals.created_at
    } as MarketDataDaily : undefined
  };
}