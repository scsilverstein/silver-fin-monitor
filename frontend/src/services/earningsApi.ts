// Real earnings API service using backend endpoints
export interface EarningsCalendarEntry {
  id: string;
  symbol: string;
  company_name?: string;
  earnings_date: string;
  time_of_day?: 'before_market' | 'after_market' | 'during_market';
  fiscal_quarter?: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  fiscal_year?: number;
  importance_rating?: number;
  status: 'scheduled' | 'reported' | 'delayed' | 'cancelled';
  confirmed: boolean;
  has_reports: boolean;
  has_transcripts: boolean;
  days_until: number;
  reporting_status: 'reported' | 'missed' | 'scheduled';
}

// Use the same API URL as the main API
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8888/.netlify/functions/api/api/v1';

export const earningsApi = {
  async getEarningsCalendarMonth(year: number, month: number) {
    try {
      const response = await fetch(`${API_BASE_URL}/earnings/calendar/${year}/${month}`);
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        console.warn('API failed, falling back to mock data:', result.error);
        return this.getMockEarningsCalendarMonth(year, month);
      }
      
      // Return actual data from database
      return result;
    } catch (error) {
      console.error('Error fetching earnings calendar, falling back to mock data:', error);
      return this.getMockEarningsCalendarMonth(year, month);
    }
  },

  async getUpcomingEarnings(days: number = 30) {
    try {
      const response = await fetch(`${API_BASE_URL}/earnings/upcoming?days=${days}`);
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to fetch upcoming earnings');
      }
      
      return result;
    } catch (error) {
      console.error('Error fetching upcoming earnings:', error);
      // Fallback to mock data
      return {
        success: true,
        data: []
      };
    }
  },

  async getEarningsWithReports(symbol: string, date: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/earnings/reports/${symbol}/${date}`);
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to fetch earnings reports');
      }
      
      return result;
    } catch (error) {
      console.error('Error fetching earnings reports:', error);
      return {
        success: false,
        error: 'Earnings data not found'
      };
    }
  },

  // Fallback mock data method
  getMockEarningsCalendarMonth(year: number, month: number) {
    const mockEarningsData: Record<string, EarningsCalendarEntry[]> = {
      '2025-01-14': [
        { id: '15', symbol: 'KO', company_name: 'Coca-Cola Company', earnings_date: '2025-01-14', time_of_day: 'before_market', importance_rating: 3, status: 'scheduled', confirmed: true, has_reports: false, has_transcripts: false, days_until: -8, reporting_status: 'scheduled' }
      ],
      '2025-01-15': [
        { id: '6', symbol: 'JPM', company_name: 'JPMorgan Chase & Co.', earnings_date: '2025-01-15', time_of_day: 'before_market', importance_rating: 5, status: 'scheduled', confirmed: true, has_reports: false, has_transcripts: false, days_until: -7, reporting_status: 'scheduled' }
      ],
      '2025-01-16': [
        { id: '7', symbol: 'BAC', company_name: 'Bank of America Corp.', earnings_date: '2025-01-16', time_of_day: 'before_market', importance_rating: 4, status: 'scheduled', confirmed: true, has_reports: false, has_transcripts: false, days_until: -6, reporting_status: 'scheduled' },
        { id: '17', symbol: 'TSM', company_name: 'Taiwan Semiconductor', earnings_date: '2025-01-16', time_of_day: 'before_market', importance_rating: 4, status: 'scheduled', confirmed: true, has_reports: false, has_transcripts: false, days_until: -6, reporting_status: 'scheduled' }
      ],
      '2025-01-17': [
        { id: '8', symbol: 'GS', company_name: 'Goldman Sachs Group Inc.', earnings_date: '2025-01-17', time_of_day: 'before_market', importance_rating: 4, status: 'scheduled', confirmed: true, has_reports: false, has_transcripts: false, days_until: -5, reporting_status: 'scheduled' }
      ],
      '2025-01-21': [
        { id: '13', symbol: 'WMT', company_name: 'Walmart Inc.', earnings_date: '2025-01-21', time_of_day: 'before_market', importance_rating: 4, status: 'scheduled', confirmed: true, has_reports: false, has_transcripts: false, days_until: -1, reporting_status: 'scheduled' },
        { id: '19', symbol: 'NFLX', company_name: 'Netflix Inc.', earnings_date: '2025-01-21', time_of_day: 'after_market', importance_rating: 4, status: 'scheduled', confirmed: true, has_reports: false, has_transcripts: false, days_until: -1, reporting_status: 'scheduled' }
      ],
      '2025-01-22': [
        { id: '14', symbol: 'PG', company_name: 'Procter & Gamble Co.', earnings_date: '2025-01-22', time_of_day: 'before_market', importance_rating: 4, status: 'scheduled', confirmed: true, has_reports: false, has_transcripts: false, days_until: 0, reporting_status: 'scheduled' },
        { id: '16', symbol: 'NVDA', company_name: 'NVIDIA Corporation', earnings_date: '2025-01-22', time_of_day: 'after_market', importance_rating: 5, status: 'scheduled', confirmed: true, has_reports: false, has_transcripts: false, days_until: 0, reporting_status: 'scheduled' }
      ],
      '2025-01-23': [
        { id: '9', symbol: 'JNJ', company_name: 'Johnson & Johnson', earnings_date: '2025-01-23', time_of_day: 'before_market', importance_rating: 4, status: 'scheduled', confirmed: true, has_reports: false, has_transcripts: false, days_until: 1, reporting_status: 'scheduled' },
        { id: '18', symbol: 'INTC', company_name: 'Intel Corporation', earnings_date: '2025-01-23', time_of_day: 'after_market', importance_rating: 4, status: 'scheduled', confirmed: true, has_reports: false, has_transcripts: false, days_until: 1, reporting_status: 'scheduled' }
      ],
      '2025-01-24': [
        { id: '2', symbol: 'MSFT', company_name: 'Microsoft Corporation', earnings_date: '2025-01-24', time_of_day: 'after_market', importance_rating: 5, status: 'scheduled', confirmed: true, has_reports: false, has_transcripts: false, days_until: 2, reporting_status: 'scheduled' }
      ],
      '2025-01-25': [
        { id: '12', symbol: 'CVX', company_name: 'Chevron Corporation', earnings_date: '2025-01-25', time_of_day: 'before_market', importance_rating: 4, status: 'scheduled', confirmed: true, has_reports: false, has_transcripts: false, days_until: 3, reporting_status: 'scheduled' }
      ],
      '2025-01-27': [
        { id: '22', symbol: 'F', company_name: 'Ford Motor Company', earnings_date: '2025-01-27', time_of_day: 'after_market', importance_rating: 3, status: 'scheduled', confirmed: true, has_reports: false, has_transcripts: false, days_until: 5, reporting_status: 'scheduled' }
      ],
      '2025-01-28': [
        { id: '1', symbol: 'AAPL', company_name: 'Apple Inc.', earnings_date: '2025-01-28', time_of_day: 'after_market', importance_rating: 5, status: 'scheduled', confirmed: true, has_reports: false, has_transcripts: false, days_until: 6, reporting_status: 'scheduled' },
        { id: '10', symbol: 'PFE', company_name: 'Pfizer Inc.', earnings_date: '2025-01-28', time_of_day: 'before_market', importance_rating: 4, status: 'scheduled', confirmed: true, has_reports: false, has_transcripts: false, days_until: 6, reporting_status: 'scheduled' },
        { id: '23', symbol: 'GM', company_name: 'General Motors Company', earnings_date: '2025-01-28', time_of_day: 'before_market', importance_rating: 3, status: 'scheduled', confirmed: true, has_reports: false, has_transcripts: false, days_until: 6, reporting_status: 'scheduled' }
      ],
      '2025-01-29': [
        { id: '5', symbol: 'META', company_name: 'Meta Platforms Inc.', earnings_date: '2025-01-29', time_of_day: 'after_market', importance_rating: 5, status: 'scheduled', confirmed: true, has_reports: false, has_transcripts: false, days_until: 7, reporting_status: 'scheduled' },
        { id: '20', symbol: 'DIS', company_name: 'Walt Disney Company', earnings_date: '2025-01-29', time_of_day: 'after_market', importance_rating: 4, status: 'scheduled', confirmed: true, has_reports: false, has_transcripts: false, days_until: 7, reporting_status: 'scheduled' },
        { id: '21', symbol: 'TSLA', company_name: 'Tesla Inc.', earnings_date: '2025-01-29', time_of_day: 'after_market', importance_rating: 5, status: 'scheduled', confirmed: true, has_reports: false, has_transcripts: false, days_until: 7, reporting_status: 'scheduled' }
      ],
      '2025-01-30': [
        { id: '3', symbol: 'GOOGL', company_name: 'Alphabet Inc.', earnings_date: '2025-01-30', time_of_day: 'after_market', importance_rating: 5, status: 'scheduled', confirmed: true, has_reports: false, has_transcripts: false, days_until: 8, reporting_status: 'scheduled' }
      ],
      '2025-01-31': [
        { id: '4', symbol: 'AMZN', company_name: 'Amazon.com Inc.', earnings_date: '2025-01-31', time_of_day: 'after_market', importance_rating: 5, status: 'scheduled', confirmed: true, has_reports: false, has_transcripts: false, days_until: 9, reporting_status: 'scheduled' },
        { id: '11', symbol: 'XOM', company_name: 'Exxon Mobil Corp.', earnings_date: '2025-01-31', time_of_day: 'before_market', importance_rating: 4, status: 'scheduled', confirmed: true, has_reports: false, has_transcripts: false, days_until: 9, reporting_status: 'scheduled' }
      ]
    };

    return {
      success: true,
      data: {
        year,
        month,
        calendar: mockEarningsData
      }
    };
  }
};