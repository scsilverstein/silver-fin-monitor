import { api } from './api';

// Types for intelligence data
export interface SignalDivergenceData {
  current: {
    timestamp: string;
    sources: {
      name: string;
      sentiment: number;
      confidence: number;
      volumeNormalized: number;
    }[];
    divergenceScore: number;
    marketEvent?: string;
  };
  historical: any[];
  timeline: any[];
}

export interface EntityNetworkData {
  nodes: {
    id: string;
    name: string;
    type: 'company' | 'person' | 'location';
    mentionCount: number;
    avgSentiment: number;
    volatility: number;
  }[];
  edges: {
    source: string;
    target: string;
    coMentionCount: number;
    sentimentCorrelation: number;
    timelag?: number;
  }[];
  stats: {
    totalNodes: number;
    totalEdges: number;
    avgConnections: number;
  };
}

export interface AnomalyData {
  date: string;
  anomalies: {
    sentimentAnomaly: number;
    volumeAnomaly: number;
    topicAnomaly: number;
    entityAnomaly: number;
    velocityAnomaly: number;
  };
  events?: string[];
}

export interface PredictiveMatrixData {
  signals: {
    source: string;
    signalType: string;
    outcomes: {
      marketMove: string;
      leadTime: number;
      accuracy: number;
      confidence: number;
      instances: number;
    }[];
  }[];
}

export interface IntelligenceAlert {
  id: string;
  type: 'divergence' | 'anomaly' | 'network' | 'prediction';
  severity: 'low' | 'medium' | 'high';
  title: string;
  message: string;
  data?: any;
  timestamp: string;
}

export interface NarrativeMomentumData {
  narratives: {
    narrative: string;
    timeframe: string;
    velocity: number;
    acceleration: number;
    dominance: number;
    crossoverScore: number;
    sentimentEvolution: {
      current: number;
      trend: 'strengthening' | 'weakening' | 'stable';
      volatility: number;
    };
    sourceBreakdown: {
      mainstream: number;
      specialized: number;
      social: number;
    };
    mutations: {
      originalForm: string;
      currentForm: string;
      similarityScore: number;
    }[];
    predictiveSignals: {
      momentum: number;
      breakoutProbability: number;
      estimatedPeakTime: string;
      marketRelevance: number;
    };
    historicalComparisons: {
      similarNarratives: string[];
      averageLifespan: number;
      typicalOutcomes: string[];
    };
  }[];
  alerts: {
    id: string;
    narrative: string;
    alertType: 'explosive_growth' | 'crossover_imminent' | 'narrative_mutation' | 'momentum_reversal';
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    message: string;
    actionable: {
      timeWindow: string;
      suggestedActions: string[];
      riskLevel: string;
    };
    data: any;
    timestamp: string;
  }[];
  stats: {
    totalNarratives: number;
    explosiveNarratives: number;
    crossoverCandidates: number;
    highMomentum: number;
  };
  timeframe: string;
  timestamp: string;
}

export interface SilenceDetectionData {
  alerts: {
    id: string;
    entityName: string;
    entityType: 'company' | 'person' | 'topic' | 'sector';
    silenceType: 'sudden_drop' | 'expected_absence' | 'pre_announcement' | 'information_void';
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    
    expectedMentions: number;
    actualMentions: number;
    silenceRatio: number;
    silenceDuration: number;
    
    historicalPattern: {
      averageMentions: number;
      typicalSilenceBefore: string[];
      lastMajorEvent: string;
      daysSinceLastEvent: number;
    };
    
    predictionSignals: {
      announcementProbability: number;
      timeToEvent: number;
      eventType: string;
      marketImpactPotential: 'low' | 'medium' | 'high';
    };
    
    contextualFactors: {
      earningsSeasonProximity: boolean;
      marketConditions: string;
      sectorActivity: number;
      relatedEntitySilences: string[];
    };
    
    actionable: {
      watchWindow: string;
      monitoringSuggestions: string[];
      riskLevel: string;
      potentialCatalysts: string[];
    };
    
    timestamp: string;
    detectedAt: string;
  }[];
  stats: {
    totalAlerts: number;
    bySeverity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    byType: {
      sudden_drop: number;
      pre_announcement: number;
      information_void: number;
      expected_absence: number;
    };
    byEntityType: {
      company: number;
      person: number;
      topic: number;
      sector: number;
    };
    avgSilenceDuration: number;
    highProbabilityEvents: number;
  };
  metadata: {
    lookbackDays: number;
    detectionTimestamp: string;
    totalEntitiesAnalyzed: number;
    alertThresholds: {
      anomalyThreshold: number;
      minimumSilenceHours: number;
      confidenceThreshold: number;
    };
  };
}

export interface LanguageComplexityAnalysis {
  id: string;
  entityName: string;
  entityType: 'company' | 'person' | 'topic' | 'document';
  timeframe: string;
  
  complexityScore: number;
  readabilityScore: number;
  uncertaintyLevel: number;
  evasivenessFactor: number;
  
  linguisticMetrics: {
    averageWordsPerSentence: number;
    averageSyllablesPerWord: number;
    lexicalDiversity: number;
    sentenceComplexity: number;
    passiveVoiceRatio: number;
    modalVerbUsage: number;
    hedgingLanguage: number;
    qualifierDensity: number;
  };
  
  confidenceMetrics: {
    assertivenessScore: number;
    confidenceLanguage: number;
    certaintyIndicators: number;
    tentativeLanguage: number;
    deflectionPatterns: number;
  };
  
  anomalyDetection: {
    deviationFromBaseline: number;
    unusualPatterns: string[];
    communicationShifts: {
      direction: 'more_complex' | 'less_complex' | 'stable';
      magnitude: number;
      timeframe: string;
    };
    redFlags: {
      type: 'excessive_hedging' | 'passive_deflection' | 'complexity_spike' | 'jargon_overload';
      severity: 'low' | 'medium' | 'high';
      description: string;
    }[];
  };
  
  riskAssessment: {
    communicationRisk: 'low' | 'medium' | 'high' | 'critical';
    probabilityOfConcern: number;
    timeToEvent: number;
    suggestedActions: string[];
    monitoringPriority: 'low' | 'medium' | 'high';
  };
  
  examples: {
    complex: string[];
    evasive: string[];
    uncertain: string[];
    clear: string[];
  };
  
  timestamp: string;
  analysisDate: string;
}

export interface LanguageComplexityData {
  analyses: LanguageComplexityAnalysis[];
  alerts: any[];
  stats: {
    totalAnalyzed: number;
    highRisk: number;
    complexitySpikes: number;
    evasiveLanguage: number;
    avgComplexity: number;
    avgUncertainty: number;
  };
  timeframe: string;
  timestamp: string;
}

// API functions
export const intelligenceApi = {
  // Get signal divergence data
  async getSignalDivergence(timeframe = '7d', sources?: string[]): Promise<SignalDivergenceData> {
    const params = new URLSearchParams({ timeframe });
    if (sources?.length) {
      params.append('sources', sources.join(','));
    }
    const response = await api.get(`/intelligence/divergence?${params}`);
    return response.data.data;
  },

  // Get entity network data
  async getEntityNetwork(timeframe = '7d', minMentions = 5): Promise<EntityNetworkData> {
    const params = new URLSearchParams({
      timeframe,
      minMentions: minMentions.toString()
    });
    const response = await api.get(`/intelligence/network?${params}`);
    return response.data.data;
  },

  // Get anomaly calendar data
  async getAnomalyCalendar(month?: string): Promise<AnomalyData[]> {
    const params = new URLSearchParams();
    if (month) {
      params.append('month', month);
    }
    const response = await api.get(`/intelligence/anomalies?${params}`);
    return response.data.data;
  },

  // Get predictive matrix
  async getPredictiveMatrix(lookback = '90d'): Promise<PredictiveMatrixData> {
    const params = new URLSearchParams({ lookback });
    const response = await api.get(`/intelligence/predictive-matrix?${params}`);
    return response.data.data;
  },

  // Get real-time alerts
  async getAlerts(severity?: 'low' | 'medium' | 'high' | 'all'): Promise<{ alerts: IntelligenceAlert[]; timestamp: string }> {
    const params = new URLSearchParams();
    if (severity) {
      params.append('severity', severity);
    }
    const response = await api.get(`/intelligence/alerts?${params}`);
    return response.data.data;
  },

  // Get narrative momentum analysis
  async getNarrativeMomentum(timeframe: '24h' | '7d' | '30d' = '24h'): Promise<NarrativeMomentumData> {
    const params = new URLSearchParams({ timeframe });
    const response = await api.get(`/intelligence/narrative-momentum?${params}`);
    return response.data.data;
  },

  // Get silence detection alerts
  async getSilenceDetection(lookbackDays: number = 30): Promise<SilenceDetectionData> {
    const params = new URLSearchParams({ lookbackDays: lookbackDays.toString() });
    const response = await api.get(`/intelligence/silence-detection?${params}`);
    return response.data.data;
  },

  // Get language complexity analysis
  async getLanguageComplexity(timeframe: '24h' | '7d' | '30d' = '7d'): Promise<LanguageComplexityData> {
    const params = new URLSearchParams({ timeframe });
    const response = await api.get(`/intelligence/language-complexity?${params}`);
    return response.data.data;
  }
};