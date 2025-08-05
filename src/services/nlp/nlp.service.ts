import { ContentEntity } from '../../types';

export class NLPService {
  // Extract entities from text
  async extractEntities(text: string): Promise<{
    companies: string[];
    people: string[];
    locations: string[];
    tickers: string[];
  }> {
    // Basic entity extraction - in production, use NLP libraries or APIs
    const entities = {
      companies: this.extractCompanies(text),
      people: this.extractPeople(text),
      locations: this.extractLocations(text),
      tickers: this.extractTickers(text)
    };

    return entities;
  }

  // Extract key topics from text
  async extractTopics(text: string): Promise<string[]> {
    // Basic topic extraction - in production, use NLP libraries
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);
    const words = text.toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 3 && !commonWords.has(word));
    
    // Count word frequency
    const wordFreq = new Map<string, number>();
    words.forEach(word => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    });
    
    // Get top topics
    const topics = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
    
    return topics;
  }

  // Analyze sentiment
  async analyzeSentiment(text: string): Promise<number> {
    // Basic sentiment analysis - in production, use proper NLP models
    const positiveWords = ['good', 'great', 'excellent', 'positive', 'bullish', 'strong', 'growth', 'increase', 'rise', 'gain'];
    const negativeWords = ['bad', 'poor', 'negative', 'bearish', 'weak', 'decline', 'decrease', 'fall', 'loss', 'drop'];
    
    const textLower = text.toLowerCase();
    let score = 0;
    
    positiveWords.forEach(word => {
      if (textLower.includes(word)) score += 0.1;
    });
    
    negativeWords.forEach(word => {
      if (textLower.includes(word)) score -= 0.1;
    });
    
    // Clamp between -1 and 1
    return Math.max(-1, Math.min(1, score));
  }

  // Generate summary
  async generateSummary(text: string, maxLength: number = 200): Promise<string> {
    // Basic summarization - in production, use AI models
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    const summary = sentences.slice(0, 3).join(' ');
    
    if (summary.length > maxLength) {
      return summary.substring(0, maxLength) + '...';
    }
    
    return summary;
  }

  // Private helper methods
  private extractCompanies(text: string): string[] {
    // Pattern for common company suffixes
    const pattern = /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\s+(?:Inc|Corp|Corporation|LLC|Ltd|Company|Co)\b/g;
    const matches = text.match(pattern) || [];
    return [...new Set(matches)];
  }

  private extractPeople(text: string): string[] {
    // Pattern for names (simplified)
    const pattern = /\b([A-Z][a-z]+)\s+([A-Z][a-z]+)(?:\s+[A-Z][a-z]+)?\b/g;
    const matches = text.match(pattern) || [];
    return [...new Set(matches)].slice(0, 10); // Limit to 10 to avoid false positives
  }

  private extractLocations(text: string): string[] {
    // Common location indicators
    const locationWords = ['New York', 'London', 'Tokyo', 'Hong Kong', 'Singapore', 'Beijing', 'Shanghai', 'San Francisco', 'Washington'];
    const found: string[] = [];
    
    locationWords.forEach(location => {
      if (text.includes(location)) {
        found.push(location);
      }
    });
    
    return found;
  }

  private extractTickers(text: string): string[] {
    // Pattern for stock tickers
    const pattern = /\b([A-Z]{1,5})\b(?:\s+(?:stock|shares|ticker))?/g;
    const matches = text.match(pattern) || [];
    
    // Filter to likely tickers (2-5 uppercase letters)
    return [...new Set(matches)]
      .filter(ticker => ticker.length >= 2 && ticker.length <= 5 && /^[A-Z]+$/.test(ticker))
      .slice(0, 10);
  }
}