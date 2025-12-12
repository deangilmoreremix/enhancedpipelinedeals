import { Handler } from '@netlify/functions';
import { enhancedContactImportService } from '../../src/services/enhancedContactImportService';
import { contactTemplateService } from '../../src/services/contactTemplateService';
import { contactDuplicateService } from '../../src/services/contactDuplicateService';

interface ImportRequest {
  fileContent: string | ArrayBuffer;
  format: 'csv' | 'json' | 'excel' | 'xml' | 'tsv' | 'yaml';
  templateId: string;
  enrichmentOptions: {
    enrichCompanyData: boolean;
    discoverSocialProfiles: boolean;
    analyzeBuyingSignals: boolean;
    generateLeadScoring: boolean;
    includeWebResearch: boolean;
    maxResearchResults?: number;
  };
  duplicateResolution?: 'auto' | 'manual';
}

export const handler: Handler = async (event) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Validate request
    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Request body is required' })
      };
    }

    const request: ImportRequest = JSON.parse(event.body);

    // Validate required fields
    if (!request.fileContent || !request.format || !request.templateId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Missing required fields: fileContent, format, templateId'
        })
      };
    }

    // Validate template exists
    const template = contactTemplateService.getTemplate(request.templateId);
    if (!template) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid template ID' })
      };
    }

    console.log(`🚀 Starting enhanced contact import with template: ${template.name}`);

    // Set default enrichment options
    const enrichmentOptions = {
      enrichCompanyData: true,
      discoverSocialProfiles: true,
      analyzeBuyingSignals: true,
      generateLeadScoring: true,
      includeWebResearch: true,
      maxResearchResults: 3,
      ...request.enrichmentOptions
    };

    // Progress tracking for long-running imports
    let progressCallback: ((progress: any) => void) | undefined;

    // For real-time progress, we could use WebSockets or Server-Sent Events
    // For now, we'll process synchronously and return results

    const results = await enhancedContactImportService.importContactsWithAI(
      request.fileContent,
      request.format,
      enrichmentOptions,
      progressCallback
    );

    // Handle duplicates based on resolution strategy
    if (results.duplicates.length > 0) {
      if (request.duplicateResolution === 'auto') {
        // Auto-resolve duplicates (merge high-confidence ones)
        const resolutions = results.duplicates.map(duplicate => ({
          action: duplicate.confidence > 80 ? 'merge' : 'keep_both'
        }));

        for (let i = 0; i < resolutions.length; i++) {
          const resolution = resolutions[i];
          const duplicate = results.duplicates[i];

          await contactDuplicateService.resolveDuplicate(duplicate, {
            action: resolution.action as any,
            primaryContactId: duplicate.existing[0]?.id
          });
        }

        // Update results
        results.duplicateCount = 0;
        results.successCount += results.duplicates.length;
      }
      // For 'manual', return duplicates for client-side resolution
    }

    // Update template usage stats
    contactTemplateService.updateTemplateStats(request.templateId, {
      totalImports: template.usageStats.totalImports + 1,
      successRate: results.successCount / results.totalProcessed,
      averageProcessingTime: results.processingTime
    });

    console.log(`✅ Contact import completed: ${results.successCount} success, ${results.errorCount} errors, ${results.duplicateCount} duplicates`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        results,
        processingTime: results.processingTime,
        templateUsed: template.name
      })
    };

  } catch (error) {
    console.error('❌ Enhanced contact import failed:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      })
    };
  }
};
