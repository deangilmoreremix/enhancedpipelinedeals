/**
 * Import Scheduler Service - Manages automated and scheduled data imports
 * Supports recurring imports from various sources with monitoring and error handling
 */

import { getEnhancedImportService, ImportResult, DetailedProgress } from './enhancedImportService';
import { getImportTemplateService, ImportTemplate } from './importTemplateService';
import { getMonitoringService } from './monitoringService';

export interface ScheduledImport {
  id: string;
  name: string;
  description?: string;
  source: ImportSource;
  templateId: string;
  schedule: ImportSchedule;
  isActive: boolean;
  lastRun?: Date;
  nextRun?: Date;
  successCount: number;
  failureCount: number;
  totalRecordsImported: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface ImportSource {
  type: 'url' | 'sftp' | 'api' | 'email' | 'webhook' | 'file';
  config: {
    url?: string;
    credentials?: {
      username?: string;
      password?: string;
      apiKey?: string;
      token?: string;
    };
    headers?: Record<string, string>;
    queryParams?: Record<string, string>;
    filePath?: string;
    emailConfig?: {
      mailbox: string;
      subjectFilter?: string;
      senderFilter?: string;
    };
    webhookConfig?: {
      secret: string;
      validationField?: string;
    };
  };
  format: 'csv' | 'json' | 'excel';
  encoding?: string;
  delimiter?: string;
}

export interface ImportSchedule {
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';
  time: string; // HH:MM format
  timezone: string;
  customCron?: string; // For custom frequency
  daysOfWeek?: number[]; // 0-6, Sunday = 0
  daysOfMonth?: number[]; // 1-31
  startDate?: Date;
  endDate?: Date;
}

export interface ImportExecution {
  id: string;
  scheduledImportId: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  result?: ImportResult<any>;
  error?: string;
  recordsProcessed: number;
  duration: number; // milliseconds
  progress: DetailedProgress;
}

class ImportSchedulerService {
  private scheduledImports: Map<string, ScheduledImport> = new Map();
  private activeExecutions: Map<string, ImportExecution> = new Map();
  private intervalId?: NodeJS.Timeout;
  private isRunning: boolean = false;

  constructor() {
    this.startScheduler();
  }

  /**
   * Create a new scheduled import
   */
  createScheduledImport(config: Omit<ScheduledImport, 'id' | 'nextRun' | 'successCount' | 'failureCount' | 'totalRecordsImported' | 'createdAt' | 'updatedAt'>): ScheduledImport {
    const scheduledImport: ScheduledImport = {
      ...config,
      id: `scheduled-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      nextRun: this.calculateNextRun(config.schedule),
      successCount: 0,
      failureCount: 0,
      totalRecordsImported: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.scheduledImports.set(scheduledImport.id, scheduledImport);
    return scheduledImport;
  }

  /**
   * Update scheduled import
   */
  updateScheduledImport(id: string, updates: Partial<ScheduledImport>): ScheduledImport | null {
    const existing = this.scheduledImports.get(id);
    if (!existing) return null;

    const updated: ScheduledImport = {
      ...existing,
      ...updates,
      nextRun: updates.schedule ? this.calculateNextRun(updates.schedule) : existing.nextRun,
      updatedAt: new Date()
    };

    this.scheduledImports.set(id, updated);
    return updated;
  }

  /**
   * Delete scheduled import
   */
  deleteScheduledImport(id: string): boolean {
    const execution = this.activeExecutions.get(id);
    if (execution && execution.status === 'running') {
      // Cancel running execution
      this.cancelExecution(id);
    }
    return this.scheduledImports.delete(id);
  }

  /**
   * Get all scheduled imports
   */
  getAllScheduledImports(): ScheduledImport[] {
    return Array.from(this.scheduledImports.values());
  }

  /**
   * Get scheduled import by ID
   */
  getScheduledImport(id: string): ScheduledImport | undefined {
    return this.scheduledImports.get(id);
  }

  /**
   * Get scheduled imports by user
   */
  getScheduledImportsByUser(userId: string): ScheduledImport[] {
    return this.getAllScheduledImports().filter(imp => imp.createdBy === userId);
  }

  /**
   * Manually trigger import execution
   */
  async executeScheduledImport(id: string): Promise<ImportExecution> {
    const scheduledImport = this.scheduledImports.get(id);
    if (!scheduledImport) {
      throw new Error('Scheduled import not found');
    }

    if (!scheduledImport.isActive) {
      throw new Error('Scheduled import is not active');
    }

    const execution: ImportExecution = {
      id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      scheduledImportId: id,
      startedAt: new Date(),
      status: 'running',
      recordsProcessed: 0,
      duration: 0,
      progress: {
        current: 0,
        total: 0,
        status: 'parsing',
        phase: 'parsing',
        phaseProgress: 0,
        errors: [],
        warnings: []
      }
    };

    this.activeExecutions.set(execution.id, execution);

    try {
      // Fetch data from source
      const data = await this.fetchDataFromSource(scheduledImport.source);

      // Get template
      const templateService = getImportTemplateService();
      const template = templateService.getTemplate(scheduledImport.templateId);
      if (!template) {
        throw new Error('Import template not found');
      }

      // Execute import
      const importService = getEnhancedImportService();
      const result = await this.executeImportWithTemplate(importService, data, template, execution);

      // Update execution
      execution.completedAt = new Date();
      execution.status = 'completed';
      execution.result = result;
      execution.recordsProcessed = result.totalProcessed;
      execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();

      // Update scheduled import stats
      scheduledImport.lastRun = new Date();
      scheduledImport.nextRun = this.calculateNextRun(scheduledImport.schedule);
      scheduledImport.successCount++;
      scheduledImport.totalRecordsImported += result.successCount;

      this.activeExecutions.set(execution.id, execution);
      this.scheduledImports.set(id, scheduledImport);

      // Track success
      const monitoring = getMonitoringService();
      monitoring.trackAIFunctionCall('scheduled_import', execution.duration, true, scheduledImport.createdBy, {
        importId: id,
        recordsImported: result.successCount
      });

      return execution;

    } catch (error) {
      execution.completedAt = new Date();
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Import failed';
      execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();

      // Update scheduled import stats
      scheduledImport.failureCount++;

      this.activeExecutions.set(execution.id, execution);
      this.scheduledImports.set(id, scheduledImport);

      // Track failure
      const monitoring = getMonitoringService();
      monitoring.trackAIFunctionCall('scheduled_import', execution.duration, false, scheduledImport.createdBy, {
        importId: id,
        error: execution.error
      });

      throw error;
    }
  }

  /**
   * Cancel running execution
   */
  cancelExecution(executionId: string): boolean {
    const execution = this.activeExecutions.get(executionId);
    if (execution && execution.status === 'running') {
      execution.status = 'cancelled';
      execution.completedAt = new Date();
      this.activeExecutions.set(executionId, execution);
      return true;
    }
    return false;
  }

  /**
   * Get execution history
   */
  getExecutionHistory(scheduledImportId?: string, limit: number = 50): ImportExecution[] {
    let executions = Array.from(this.activeExecutions.values());

    if (scheduledImportId) {
      executions = executions.filter(exec => exec.scheduledImportId === scheduledImportId);
    }

    return executions
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get active executions
   */
  getActiveExecutions(): ImportExecution[] {
    return Array.from(this.activeExecutions.values())
      .filter(exec => exec.status === 'running');
  }

  /**
   * Start the scheduler
   */
  private startScheduler(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.intervalId = setInterval(() => {
      this.checkAndExecuteScheduledImports();
    }, 60000); // Check every minute
  }

  /**
   * Stop the scheduler
   */
  stopScheduler(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isRunning = false;
  }

  /**
   * Check and execute due scheduled imports
   */
  private async checkAndExecuteScheduledImports(): Promise<void> {
    const now = new Date();

    for (const [id, scheduledImport] of this.scheduledImports) {
      if (!scheduledImport.isActive) continue;
      if (!scheduledImport.nextRun) continue;

      if (now >= scheduledImport.nextRun) {
        try {
          await this.executeScheduledImport(id);
        } catch (error) {
          console.error(`Failed to execute scheduled import ${id}:`, error);
        }
      }
    }
  }

  /**
   * Calculate next run time
   */
  private calculateNextRun(schedule: ImportSchedule): Date {
    const now = new Date();
    const [hours, minutes] = schedule.time.split(':').map(Number);

    const nextRun = new Date(now);
    nextRun.setHours(hours, minutes, 0, 0);

    if (nextRun <= now) {
      // Time has passed today, schedule for next occurrence
      switch (schedule.frequency) {
        case 'hourly':
          nextRun.setHours(nextRun.getHours() + 1);
          break;
        case 'daily':
          nextRun.setDate(nextRun.getDate() + 1);
          break;
        case 'weekly':
          nextRun.setDate(nextRun.getDate() + 7);
          break;
        case 'monthly':
          nextRun.setMonth(nextRun.getMonth() + 1);
          break;
      }
    }

    return nextRun;
  }

  /**
   * Fetch data from configured source
   */
  private async fetchDataFromSource(source: ImportSource): Promise<string> {
    switch (source.type) {
      case 'url':
        return await this.fetchFromUrl(source);
      case 'api':
        return await this.fetchFromApi(source);
      case 'file':
        return await this.readFromFile(source);
      case 'email':
        return await this.fetchFromEmail(source);
      default:
        throw new Error(`Unsupported source type: ${source.type}`);
    }
  }

  private async fetchFromUrl(source: ImportSource): Promise<string> {
    const response = await fetch(source.config.url!, {
      headers: source.config.headers,
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  }

  private async fetchFromApi(source: ImportSource): Promise<string> {
    const headers: Record<string, string> = { ...source.config.headers };

    if (source.config.credentials?.apiKey) {
      headers['Authorization'] = `Bearer ${source.config.credentials.apiKey}`;
    }

    const url = new URL(source.config.url!);
    if (source.config.queryParams) {
      Object.entries(source.config.queryParams).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const response = await fetch(url.toString(), {
      headers,
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return await response.text();
  }

  private async readFromFile(source: ImportSource): Promise<string> {
    // In a real implementation, this would read from a file system or cloud storage
    // For now, we'll simulate file reading
    throw new Error('File reading not implemented in browser environment');
  }

  private async fetchFromEmail(source: ImportSource): Promise<string> {
    // In a real implementation, this would connect to email server
    // For now, we'll simulate email fetching
    throw new Error('Email fetching not implemented');
  }

  /**
   * Execute import with template
   */
  private async executeImportWithTemplate(
    importService: any,
    data: string,
    template: ImportTemplate,
    execution: ImportExecution
  ): Promise<ImportResult<any>> {
    // This would integrate with the enhanced import service
    // For now, return a mock result
    return {
      success: [],
      errors: [],
      totalProcessed: 0,
      successCount: 0,
      errorCount: 0
    };
  }
}

// Singleton instance
let importSchedulerServiceInstance: ImportSchedulerService | null = null;

export const getImportSchedulerService = (): ImportSchedulerService => {
  if (!importSchedulerServiceInstance) {
    importSchedulerServiceInstance = new ImportSchedulerService();
  }
  return importSchedulerServiceInstance;
};

export { ImportSchedulerService };