#!/usr/bin/env tsx

/**
 * Interactive Historical Analysis Script
 * 
 * Provides a user-friendly interface to select backfill duration
 * and run historical analysis with various options
 */

import { createInterface } from 'readline';
import { runHistoricalAnalysis, HistoricalAnalysisOptions } from './historical-analysis';
import { logger } from '../src/utils/logger';

interface DurationOption {
  label: string;
  days: number;
  description: string;
}

const durationOptions: DurationOption[] = [
  { label: '1 Hour', days: 0.04, description: 'Fetch content from the last hour' },
  { label: '6 Hours', days: 0.25, description: 'Fetch content from the last 6 hours' },
  { label: '24 Hours', days: 1, description: 'Fetch content from the last 24 hours' },
  { label: '3 Days', days: 3, description: 'Fetch content from the last 3 days' },
  { label: '1 Week', days: 7, description: 'Fetch content from the last week' },
  { label: '2 Weeks', days: 14, description: 'Fetch content from the last 2 weeks' },
  { label: '1 Month', days: 30, description: 'Fetch content from the last month' },
  { label: '3 Months', days: 90, description: 'Fetch content from the last 3 months' },
  { label: 'Custom', days: 0, description: 'Enter a custom number of days' }
];

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
};

const displayDurationMenu = () => {
  console.log('\n=== Historical Analysis - Duration Selection ===\n');
  console.log('Select how far back to fetch feed items:\n');
  
  durationOptions.forEach((option, index) => {
    console.log(`  ${index + 1}. ${option.label.padEnd(12)} - ${option.description}`);
  });
  
  console.log('\n  0. Cancel\n');
};

const getCustomDays = async (): Promise<number> => {
  const input = await question('Enter number of days to go back: ');
  const days = parseFloat(input);
  
  if (isNaN(days) || days <= 0) {
    console.log('Invalid input. Please enter a positive number.');
    return getCustomDays();
  }
  
  return days;
};

const confirmAction = async (days: number): Promise<boolean> => {
  console.log('\n=== Confirmation ===\n');
  console.log(`This will:`);
  console.log(`  1. Reset feed last_processed_at dates to ${days} days ago`);
  console.log(`  2. Fetch ALL content from the past ${days} days`);
  console.log(`  3. Process content through AI pipeline`);
  console.log(`  4. Generate analyses for each time period`);
  console.log(`  5. Create predictions based on the data\n`);
  
  if (days > 30) {
    console.log('⚠️  WARNING: Processing more than 30 days of data may take a long time!\n');
  }
  
  const answer = await question('Do you want to continue? (yes/no): ');
  return answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y';
};

const selectOptions = async (): Promise<{
  forceRefetch: boolean;
  generatePredictions: boolean;
}> => {
  console.log('\n=== Additional Options ===\n');
  
  const forceAnswer = await question('Force refetch existing content? (yes/no) [yes]: ');
  const forceRefetch = forceAnswer.toLowerCase() !== 'no' && forceAnswer.toLowerCase() !== 'n';
  
  const predAnswer = await question('Generate predictions after analysis? (yes/no) [yes]: ');
  const generatePredictions = predAnswer.toLowerCase() !== 'no' && predAnswer.toLowerCase() !== 'n';
  
  return { forceRefetch, generatePredictions };
};

const main = async () => {
  try {
    displayDurationMenu();
    
    const choice = await question('Select an option (0-9): ');
    const selectedIndex = parseInt(choice) - 1;
    
    if (choice === '0') {
      console.log('\nOperation cancelled.');
      rl.close();
      process.exit(0);
    }
    
    if (selectedIndex < 0 || selectedIndex >= durationOptions.length) {
      console.log('\nInvalid selection. Please try again.');
      return main();
    }
    
    const selectedOption = durationOptions[selectedIndex];
    let days = selectedOption.days;
    
    // Handle custom duration
    if (selectedOption.label === 'Custom') {
      days = await getCustomDays();
    }
    
    // Get additional options
    const { forceRefetch, generatePredictions } = await selectOptions();
    
    // Confirm action
    const confirmed = await confirmAction(days);
    if (!confirmed) {
      console.log('\nOperation cancelled.');
      rl.close();
      process.exit(0);
    }
    
    rl.close();
    
    // Run the analysis
    const options: HistoricalAnalysisOptions = {
      daysBack: Math.ceil(days), // Round up to ensure we get all content
      forceRefetch,
      generatePredictions
    };
    
    console.log('\n=== Starting Historical Analysis ===\n');
    console.log(`Duration: ${days} days`);
    console.log(`Force refetch: ${forceRefetch}`);
    console.log(`Generate predictions: ${generatePredictions}`);
    console.log('\nProcessing...\n');
    
    await runHistoricalAnalysis(options);
    
    console.log('\n✅ Historical analysis completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    rl.close();
    process.exit(1);
  }
};

// Add progress tracking
const originalLog = console.log;
let progressDots = 0;

console.log = (...args: any[]) => {
  // If it's a logger info message about processing, show progress
  if (args[0]?.includes && (
    args[0].includes('Queued historical fetch') ||
    args[0].includes('jobs still processing') ||
    args[0].includes('Generating analysis for') ||
    args[0].includes('Generating predictions for')
  )) {
    process.stdout.write('.');
    progressDots++;
    if (progressDots % 60 === 0) {
      process.stdout.write('\n');
    }
  } else {
    if (progressDots > 0) {
      process.stdout.write('\n');
      progressDots = 0;
    }
    originalLog(...args);
  }
};

// Run the interactive script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});