import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import QueueService, { JobType } from '../queue.service';
import { DatabaseService } from '../../database/db.service';
import winston from 'winston';

// Mock the database service
jest.mock('../../database/db.service');

describe('QueueService Deduplication', () => {
  let queueService: QueueService;
  let mockDb: jest.Mocked<DatabaseService>;
  let mockLogger: winston.Logger;

  beforeEach(() => {
    // Create mock database
    mockDb = new DatabaseService() as jest.Mocked<DatabaseService>;
    
    // Create mock logger
    mockLogger = winston.createLogger({
      silent: true // Disable logging during tests
    });

    // Create queue service
    queueService = new QueueService(mockDb, mockLogger);
  });

  describe('checkDuplicateJob', () => {
    it('should detect duplicate feed fetch jobs', async () => {
      const sourceId = 'test-source-123';
      
      // Mock database response - duplicate exists
      mockDb.query = jest.fn().mockResolvedValueOnce([{ id: 'existing-job-id' }]);

      const result = await queueService['checkDuplicateJob'](JobType.FEED_FETCH, {
        sourceId
      });

      expect(result).toBe('existing-job-id');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("payload->>'sourceId' = $2"),
        [JobType.FEED_FETCH, sourceId]
      );
    });

    it('should return null when no duplicate feed fetch exists', async () => {
      // Mock database response - no duplicates
      mockDb.query = jest.fn().mockResolvedValueOnce([]);

      const result = await queueService['checkDuplicateJob'](JobType.FEED_FETCH, {
        sourceId: 'new-source'
      });

      expect(result).toBeNull();
    });

    it('should detect duplicate content process jobs with contentId', async () => {
      const contentId = 'test-content-456';
      
      mockDb.query = jest.fn().mockResolvedValueOnce([{ id: 'existing-content-job' }]);

      const result = await queueService['checkDuplicateJob'](JobType.CONTENT_PROCESS, {
        contentId
      });

      expect(result).toBe('existing-content-job');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("payload->>'contentId' = $2"),
        [JobType.CONTENT_PROCESS, contentId]
      );
    });

    it('should detect duplicate content process jobs with rawFeedId', async () => {
      const rawFeedId = 'test-raw-789';
      
      mockDb.query = jest.fn().mockResolvedValueOnce([{ id: 'existing-raw-job' }]);

      const result = await queueService['checkDuplicateJob'](JobType.CONTENT_PROCESS, {
        rawFeedId
      });

      expect(result).toBe('existing-raw-job');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("payload->>'rawFeedId' = $2"),
        [JobType.CONTENT_PROCESS, rawFeedId]
      );
    });

    it('should detect duplicate content process jobs with sourceId and externalId', async () => {
      const sourceId = 'test-source';
      const externalId = 'test-external';
      
      mockDb.query = jest.fn().mockResolvedValueOnce([{ id: 'existing-external-job' }]);

      const result = await queueService['checkDuplicateJob'](JobType.CONTENT_PROCESS, {
        sourceId,
        externalId
      });

      expect(result).toBe('existing-external-job');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("payload->>'sourceId' = $2"),
        [JobType.CONTENT_PROCESS, sourceId, externalId]
      );
    });

    it('should detect duplicate daily analysis jobs', async () => {
      const date = '2024-01-15';
      
      mockDb.query = jest.fn().mockResolvedValueOnce([{ id: 'existing-analysis' }]);

      const result = await queueService['checkDuplicateJob'](JobType.DAILY_ANALYSIS, {
        date
      });

      expect(result).toBe('existing-analysis');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("payload->>'date' = $2"),
        [JobType.DAILY_ANALYSIS, date]
      );
    });

    it('should detect duplicate generate predictions jobs with analysisDate', async () => {
      const analysisDate = '2024-01-15';
      
      mockDb.query = jest.fn().mockResolvedValueOnce([{ id: 'existing-pred-gen' }]);

      const result = await queueService['checkDuplicateJob'](JobType.GENERATE_PREDICTIONS, {
        analysisDate
      });

      expect(result).toBe('existing-pred-gen');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("payload->>'analysisDate' = $2 OR payload->>'date' = $2"),
        [JobType.GENERATE_PREDICTIONS, analysisDate]
      );
    });

    it('should detect duplicate generate predictions jobs with analysisId', async () => {
      const analysisId = 'analysis-123';
      
      mockDb.query = jest.fn().mockResolvedValueOnce([{ id: 'existing-pred-gen-id' }]);

      const result = await queueService['checkDuplicateJob'](JobType.GENERATE_PREDICTIONS, {
        analysisId
      });

      expect(result).toBe('existing-pred-gen-id');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("payload->>'analysisId' = $2"),
        [JobType.GENERATE_PREDICTIONS, analysisId]
      );
    });

    it('should detect duplicate prediction compare jobs', async () => {
      const predictionId = 'pred-123';
      
      mockDb.query = jest.fn().mockResolvedValueOnce([{ id: 'existing-compare' }]);

      const result = await queueService['checkDuplicateJob'](JobType.PREDICTION_COMPARE, {
        predictionId
      });

      expect(result).toBe('existing-compare');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("payload->>'predictionId' = $2"),
        [JobType.PREDICTION_COMPARE, predictionId]
      );
    });

    it('should allow duplicates for job types without deduplication rules', async () => {
      const result = await queueService['checkDuplicateJob'](JobType.EMAIL_SEND, {
        to: 'test@example.com'
      });

      expect(result).toBeNull();
      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  describe('enqueue with deduplication', () => {
    it('should skip enqueuing duplicate jobs', async () => {
      // First mock: checkDuplicateJob returns existing job
      mockDb.query = jest.fn()
        .mockResolvedValueOnce([{ id: 'existing-job-123' }]);

      const jobId = await queueService.enqueue(JobType.FEED_FETCH, {
        sourceId: 'test-source'
      });

      expect(jobId).toBe('existing-job-123');
      expect(mockDb.query).toHaveBeenCalledTimes(1); // Only duplicate check, no enqueue
    });

    it('should enqueue new jobs when no duplicate exists', async () => {
      // First mock: checkDuplicateJob returns no duplicate
      // Second mock: enqueue_job returns new job ID
      mockDb.query = jest.fn()
        .mockResolvedValueOnce([]) // No duplicate
        .mockResolvedValueOnce([{ job_id: 'new-job-456' }]); // New job created

      const jobId = await queueService.enqueue(JobType.FEED_FETCH, {
        sourceId: 'new-source'
      });

      expect(jobId).toBe('new-job-456');
      expect(mockDb.query).toHaveBeenCalledTimes(2); // Duplicate check + enqueue
    });
  });

  describe('enqueueBatch with deduplication', () => {
    it('should handle batch enqueue with deduplication', async () => {
      // Mock responses for three jobs:
      // Job 1: No duplicate, create new
      // Job 2: Has duplicate
      // Job 3: No duplicate, create new
      mockDb.query = jest.fn()
        .mockResolvedValueOnce([]) // Job 1: No duplicate
        .mockResolvedValueOnce([{ job_id: 'new-job-1' }]) // Job 1: Created
        .mockResolvedValueOnce([{ id: 'existing-job-2' }]) // Job 2: Duplicate exists
        .mockResolvedValueOnce([]) // Job 3: No duplicate
        .mockResolvedValueOnce([{ job_id: 'new-job-3' }]); // Job 3: Created

      const jobs = [
        { type: JobType.FEED_FETCH, payload: { sourceId: 'source-1' } },
        { type: JobType.FEED_FETCH, payload: { sourceId: 'source-2' } },
        { type: JobType.FEED_FETCH, payload: { sourceId: 'source-3' } }
      ];

      const jobIds = await queueService.enqueueBatch(jobs);

      expect(jobIds).toEqual(['new-job-1', 'existing-job-2', 'new-job-3']);
      expect(mockDb.query).toHaveBeenCalledTimes(5); // 3 duplicate checks + 2 creates
    });

    it('should continue processing batch even if one job fails', async () => {
      mockDb.query = jest.fn()
        .mockResolvedValueOnce([]) // Job 1: No duplicate
        .mockResolvedValueOnce([{ job_id: 'job-1' }]) // Job 1: Created
        .mockRejectedValueOnce(new Error('Database error')) // Job 2: Error
        .mockResolvedValueOnce([]) // Job 3: No duplicate
        .mockResolvedValueOnce([{ job_id: 'job-3' }]); // Job 3: Created

      const jobs = [
        { type: JobType.FEED_FETCH, payload: { sourceId: 'source-1' } },
        { type: JobType.FEED_FETCH, payload: { sourceId: 'source-2' } },
        { type: JobType.FEED_FETCH, payload: { sourceId: 'source-3' } }
      ];

      const jobIds = await queueService.enqueueBatch(jobs);

      // Job 2 failed, but we still get results for jobs 1 and 3
      expect(jobIds).toEqual(['job-1', 'job-3']);
    });
  });
});