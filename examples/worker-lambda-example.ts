/**
 * Example: Worker Lambda with @EventTracking decorator
 * 
 * This example shows how to use the @EventTracking decorator with a worker Lambda
 * that processes jobs from SQS, S3 events, or other event sources.
 * The clientId is extracted from the job payload.
 */

import { SQSEvent, SQSRecord, Context } from 'aws-lambda';
import { EventTracking } from 'kx-events-decorators';

interface ProcessingJob {
  jobId: string;
  clientId: string; // Required for event tracking
  previousEventId?: string; // Optional for event chaining
  type: 'email' | 'sms' | 'push';
  recipient: string;
  template: string;
  data: Record<string, any>;
  priority: 'low' | 'normal' | 'high';
}

interface ProcessingResult {
  jobId: string;
  status: 'success' | 'failed';
  processedAt: string;
  duration: number;
  error?: string;
}

class NotificationWorker {
  /**
   * Processes email notifications
   * The clientId is extracted from the job payload
   */
  @EventTracking('notification', 'email_sent', {
    source: 'worker',
    pointsAwarded: 10, // Award points for successful email delivery
  })
  async processEmailJob(
    event: { jobId: string; clientId: string; previousEventId?: string; [key: string]: any },
    context: Context
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      console.log(`Processing email job: ${event.jobId} for client: ${event.clientId}`);
      
      // Simulate email processing
      await this.sendEmail(event as ProcessingJob);
      
      const duration = Date.now() - startTime;
      
      return {
        jobId: event.jobId,
        status: 'success',
        processedAt: new Date().toISOString(),
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Failed to process email job ${event.jobId}:`, error);
      
      return {
        jobId: event.jobId,
        status: 'failed',
        processedAt: new Date().toISOString(),
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Processes SMS notifications
   */
  @EventTracking('notification', 'sms_sent', {
    source: 'worker',
    pointsAwarded: 5,
  })
  async processSmsJob(
    event: { jobId: string; clientId: string; previousEventId?: string; [key: string]: any },
    context: Context
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      console.log(`Processing SMS job: ${event.jobId} for client: ${event.clientId}`);
      
      // Simulate SMS processing
      await this.sendSms(event as ProcessingJob);
      
      const duration = Date.now() - startTime;
      
      return {
        jobId: event.jobId,
        status: 'success',
        processedAt: new Date().toISOString(),
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Failed to process SMS job ${event.jobId}:`, error);
      
      return {
        jobId: event.jobId,
        status: 'failed',
        processedAt: new Date().toISOString(),
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Batch processor for SQS events
   * Each SQS message contains a job with clientId
   */
  @EventTracking('batch', 'batch_processed', {
    source: 'worker',
  })
  async processBatch(event: SQSEvent, context: Context): Promise<void> {
    console.log(`Processing batch of ${event.Records.length} jobs`);
    
    const results: ProcessingResult[] = [];
    
    for (const record of event.Records) {
      try {
        const job: ProcessingJob = JSON.parse(record.body);
        
        let result: ProcessingResult;
        
        switch (job.type) {
          case 'email':
            result = await this.processEmailJob(job, context);
            break;
          case 'sms':
            result = await this.processSmsJob(job, context);
            break;
          default:
            throw new Error(`Unknown job type: ${job.type}`);
        }
        
        results.push(result);
      } catch (error) {
        console.error(`Failed to process SQS record ${record.messageId}:`, error);
        results.push({
          jobId: record.messageId,
          status: 'failed',
          processedAt: new Date().toISOString(),
          duration: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    const successCount = results.filter(r => r.status === 'success').length;
    const failureCount = results.filter(r => r.status === 'failed').length;
    
    console.log(`Batch processing complete: ${successCount} success, ${failureCount} failed`);
  }

  private async sendEmail(job: ProcessingJob): Promise<void> {
    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
    
    if (Math.random() < 0.1) { // 10% failure rate for testing
      throw new Error('Email service temporarily unavailable');
    }
    
    console.log(`Email sent to ${job.recipient} using template ${job.template}`);
  }

  private async sendSms(job: ProcessingJob): Promise<void> {
    // Simulate SMS sending delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500));
    
    if (Math.random() < 0.05) { // 5% failure rate for testing
      throw new Error('SMS service temporarily unavailable');
    }
    
    console.log(`SMS sent to ${job.recipient} using template ${job.template}`);
  }
}

// Export handler functions
const worker = new NotificationWorker();

export const emailHandler = worker.processEmailJob.bind(worker);
export const smsHandler = worker.processSmsJob.bind(worker);
export const batchHandler = worker.processBatch.bind(worker);

/**
 * Example SQS message payload:
 * 
 * {
 *   "jobId": "job_123456",
 *   "clientId": "client_abc",
 *   "previousEventId": "event_789",
 *   "type": "email",
 *   "recipient": "user@example.com",
 *   "template": "welcome_email",
 *   "data": {
 *     "userName": "John Doe",
 *     "activationLink": "https://app.example.com/activate/token123"
 *   },
 *   "priority": "normal"
 * }
 * 
 * The worker will automatically track events for each processed job,
 * including the clientId and any previousEventId for event chaining.
 */
