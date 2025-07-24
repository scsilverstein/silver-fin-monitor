#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface SecSubmission {
  accessionNumber: string[];
  filingDate: string[];
  form: string[];
  primaryDocument: string[];
  primaryDocDescription: string[];
  reportDate: string[];
  act: string[];
  fileNumber: string[];
  filmNumber: string[];
  items: string[];
  size: number[];
  isXBRL: number[];
  isInlineXBRL: number[];
  acceptanceDateTime: string[];
}

interface SecCompanyData {
  cik: string;
  entityType: string;
  sic: string;
  sicDescription: string;
  name: string;
  tickers: string[];
  exchanges: string[];
  ein: string;
  description: string;
  website: string;
  category: string;
  fiscalYearEnd: string;
  stateOfIncorporation: string;
  stateOfIncorporationDescription: string;
  addresses: any;
  phone: string;
  flags: string;
  formerNames: any[];
  filings: {
    recent: SecSubmission;
    files?: any[];
  };
}

class EarningsPopulator {
  private baseUrl = 'https://data.sec.gov';
  private userAgent = 'Silver Fin Monitor earnings@silverfinmonitor.com';

  async getCompanyCik(ticker: string): Promise<string | null> {
    try {
      console.log(`Getting CIK for ${ticker}...`);
      
      const response = await fetch(`${this.baseUrl}/files/company_tickers.json`, {
        headers: { 'User-Agent': this.userAgent }
      });

      if (!response.ok) {
        throw new Error(`SEC API error: ${response.status}`);
      }

      const companies = await response.json();
      
      for (const [key, company] of Object.entries(companies as Record<string, any>)) {
        if (company.ticker?.toUpperCase() === ticker.toUpperCase()) {
          return company.cik_str.toString().padStart(10, '0');
        }
      }

      return null;
    } catch (error) {
      console.error(`Error getting CIK for ${ticker}:`, error);
      return null;
    }
  }

  async getEarningsFilings(ticker: string, lookbackDays: number = 180): Promise<any[]> {
    try {
      const cik = await this.getCompanyCik(ticker);
      if (!cik) {
        console.warn(`CIK not found for ticker ${ticker}`);
        return [];
      }

      console.log(`Getting filings for ${ticker} (CIK: ${cik})...`);

      const response = await fetch(`${this.baseUrl}/submissions/CIK${cik}.json`, {
        headers: { 'User-Agent': this.userAgent }
      });

      if (!response.ok) {
        throw new Error(`SEC API error: ${response.status}`);
      }

      const data: SecCompanyData = await response.json();
      const filings = data.filings.recent;
      
      if (!filings) {
        return [];
      }

      const earningsCalendar: any[] = [];
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

      // Process recent filings
      for (let i = 0; i < filings.form.length; i++) {
        const form = filings.form[i];
        const filingDate = filings.filingDate[i];
        
        // Only process earnings-related forms
        if (!['10-Q', '10-K', '8-K'].includes(form)) {
          continue;
        }

        const filing_date = new Date(filingDate);
        if (filing_date < cutoffDate) {
          continue;
        }

        // Determine fiscal quarter from form and filing date
        const { quarter, year } = this.determineFiscalPeriod(form, filing_date, data.fiscalYearEnd);
        
        // Calculate importance based on market cap and company size
        const importance = this.calculateImportanceRating(ticker, data.sic);

        const earningsEntry = {
          symbol: ticker.toUpperCase(),
          company_name: data.name,
          earnings_date: filingDate,
          time_of_day: 'after_market',
          fiscal_quarter: quarter,
          fiscal_year: year,
          confirmed: true,
          status: 'reported',
          data_source: 'sec_edgar',
          external_id: `${ticker}_${filingDate}_${form}`,
          importance_rating: importance,
          last_updated: new Date().toISOString(),
          created_at: new Date().toISOString()
        };

        earningsCalendar.push(earningsEntry);
      }

      return earningsCalendar;
    } catch (error) {
      console.error(`Error getting earnings filings for ${ticker}:`, error);
      return [];
    }
  }

  private determineFiscalPeriod(formType: string, filingDate: Date, fiscalYearEnd: string): { quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4', year: number } {
    const year = filingDate.getFullYear();
    
    if (formType === '10-K') {
      return { quarter: 'Q4', year };
    }

    const month = filingDate.getMonth() + 1;
    
    if (month >= 1 && month <= 3) {
      return { quarter: 'Q1', year };
    } else if (month >= 4 && month <= 6) {
      return { quarter: 'Q2', year };
    } else if (month >= 7 && month <= 9) {
      return { quarter: 'Q3', year };
    } else {
      return { quarter: 'Q4', year };
    }
  }

  private calculateImportanceRating(ticker: string, sic: string): number {
    // Mega cap tech companies
    const megaCapTech = ['AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'TSLA', 'META', 'NVDA'];
    if (megaCapTech.includes(ticker)) return 5;

    // Large cap tech
    const largeTech = ['ORCL', 'ADBE', 'CRM', 'NFLX', 'AMD', 'QCOM', 'INTC'];
    if (largeTech.includes(ticker)) return 4;

    // Financial sector (banks)
    const majorBanks = ['JPM', 'BAC', 'WFC', 'GS', 'MS', 'C'];
    if (majorBanks.includes(ticker)) return 4;

    // Major consumer/healthcare
    const majorConsumer = ['JNJ', 'PG', 'KO', 'PEP', 'WMT', 'HD'];
    if (majorConsumer.includes(ticker)) return 3;

    // Default based on SIC code
    if (sic.startsWith('737')) return 4; // Computer programming services
    if (sic.startsWith('60')) return 3;  // Banking
    if (sic.startsWith('28')) return 3;  // Chemicals/pharma
    
    return 2; // Default
  }

  async storeEarningsData(earningsData: any[]): Promise<void> {
    console.log(`Storing ${earningsData.length} earnings entries...`);

    for (const earning of earningsData) {
      const { error } = await supabase
        .from('earnings_calendar')
        .upsert(earning, {
          onConflict: 'symbol,earnings_date,fiscal_quarter,fiscal_year',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('Error storing earnings data:', error);
      }
    }
  }

  async populateEarnings(): Promise<void> {
    // Major tickers to populate
    const tickers = [
      // Tech giants
      'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA',
      // Other tech
      'ORCL', 'ADBE', 'CRM', 'NFLX', 'AMD', 'QCOM', 'INTC',
      // Financial
      'JPM', 'BAC', 'WFC', 'GS', 'MS',
      // Consumer/Healthcare
      'JNJ', 'PG', 'KO', 'PEP', 'WMT', 'HD',
      // Others
      'DIS', 'UBER', 'PYPL', 'V', 'MA'
    ];

    console.log('Starting earnings calendar population...');

    for (const ticker of tickers) {
      try {
        console.log(`\nProcessing ${ticker}...`);
        
        const earningsData = await this.getEarningsFilings(ticker, 180);
        
        if (earningsData.length > 0) {
          await this.storeEarningsData(earningsData);
          console.log(`✓ Stored ${earningsData.length} entries for ${ticker}`);
        } else {
          console.log(`- No recent filings found for ${ticker}`);
        }

        // Rate limiting - SEC allows 10 requests per second
        await this.sleep(150);
      } catch (error) {
        console.error(`Error processing ${ticker}:`, error);
        continue;
      }
    }

    console.log('\n✓ Earnings calendar population completed!');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the population
const populator = new EarningsPopulator();
populator.populateEarnings().catch(console.error);