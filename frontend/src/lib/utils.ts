import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return 'N/A';
  
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return 'Invalid Date';
    }
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    return 'Invalid Date';
  }
}

export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return 'N/A';
  
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return 'Invalid Time';
    }
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return 'Invalid Time';
  }
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

export function formatPercent(num: number): string {
  return `${(num * 100).toFixed(1)}%`;
}

export function formatCurrency(num: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(num);
}

export function parseAnalysisDate(analysis: any): Date | null {
  try {
    // Handle both camelCase and snake_case field names
    const dateStr = analysis?.analysis_date || analysis?.analysisDate;
    if (!dateStr) return null;
    
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    
    return date;
  } catch {
    return null;
  }
}

export function parseSafeDate(dateValue: any): Date | null {
  try {
    if (!dateValue) return null;
    
    const date = typeof dateValue === 'string' || typeof dateValue === 'number' 
      ? new Date(dateValue) 
      : dateValue instanceof Date 
        ? dateValue 
        : null;
        
    if (!date || isNaN(date.getTime())) return null;
    
    return date;
  } catch {
    return null;
  }
}