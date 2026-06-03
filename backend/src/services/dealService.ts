import { supabase } from '../services/database';
import { Deal, DealFilter, DealSort, PaginationInput, RequestContext } from '../types';

export class DealService {
  static async getDealById(id: string, context: RequestContext): Promise<Deal | null> {
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .eq('id', id)
      .eq('workspace_id', context.workspaceId)
      .single();

    if (error) {
      console.error('Error fetching deal:', error);
      return null;
    }

    return data;
  }

  static async getDeals(
    args: {
      filter?: DealFilter;
      sort?: DealSort[];
      pagination?: PaginationInput;
      search?: string;
    },
    context: RequestContext
  ) {
    let query = supabase
      .from('deals')
      .select('*', { count: 'exact' })
      .eq('workspace_id', context.workspaceId);

    // Apply filters
    if (args.filter) {
      if (args.filter.stage) query = query.eq('stage', args.filter.stage);
      if (args.filter.priority) query = query.eq('priority', args.filter.priority);
      if (args.filter.assignedToId) query = query.eq('assigned_to_id', args.filter.assignedToId);
      if (args.filter.company) query = query.ilike('company', `%${args.filter.company}%`);
      if (args.filter.value_min) query = query.gte('value', args.filter.value_min);
      if (args.filter.value_max) query = query.lte('value', args.filter.value_max);
      if (args.filter.probability_min) query = query.gte('probability', args.filter.probability_min);
      if (args.filter.probability_max) query = query.lte('probability', args.filter.probability_max);
      if (args.filter.createdAfter) query = query.gte('created_at', args.filter.createdAfter);
      if (args.filter.createdBefore) query = query.lte('created_at', args.filter.createdBefore);
      if (args.filter.tags && args.filter.tags.length > 0) {
        query = query.overlaps('tags', args.filter.tags);
      }
    }

    // Apply search
    if (args.search) {
      query = query.or(`title.ilike.%${args.search}%,company.ilike.%${args.search}%,contact.ilike.%${args.search}%`);
    }

    // Apply sorting
    if (args.sort && args.sort.length > 0) {
      args.sort.forEach(sort => {
        query = query.order(sort.field, { ascending: sort.direction === 'asc' });
      });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    // Apply pagination
    if (args.pagination) {
      const { page = 1, limit = 20 } = args.pagination;
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching deals:', error);
      throw new Error('Failed to fetch deals');
    }

    return {
      edges: data.map(deal => ({ node: deal, cursor: deal.id })),
      pageInfo: {
        hasNextPage: args.pagination ? ((args.pagination.page || 1) * (args.pagination.limit || 20)) < (count || 0) : false,
        hasPreviousPage: (args.pagination?.page || 1) > 1,
        startCursor: data.length > 0 ? data[0].id : null,
        endCursor: data.length > 0 ? data[data.length - 1].id : null,
      },
      totalCount: count || 0,
    };
  }

  static async createDeal(input: any, context: RequestContext): Promise<Deal> {
    const dealData = {
      ...input,
      workspace_id: context.workspaceId,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const { data, error } = await supabase
      .from('deals')
      .insert(dealData)
      .select()
      .single();

    if (error) {
      console.error('Error creating deal:', error);
      throw new Error('Failed to create deal');
    }

    // Create activity record
    await this.createActivity(data.id, 'created', 'Deal created', {}, context.user?.id);

    return data;
  }

  static async updateDeal(input: any, context: RequestContext): Promise<Deal> {
    const { id, ...updates } = input;

    const { data, error } = await supabase
      .from('deals')
      .update({
        ...updates,
        updated_at: new Date(),
      })
      .eq('id', id)
      .eq('workspace_id', context.workspaceId)
      .select()
      .single();

    if (error) {
      console.error('Error updating deal:', error);
      throw new Error('Failed to update deal');
    }

    // Create activity record
    await this.createActivity(id, 'updated', 'Deal updated', updates, context.user?.id);

    return data;
  }

  static async deleteDeal(id: string, context: RequestContext): Promise<boolean> {
    const { error } = await supabase
      .from('deals')
      .delete()
      .eq('id', id)
      .eq('workspace_id', context.workspaceId);

    if (error) {
      console.error('Error deleting deal:', error);
      return false;
    }

    return true;
  }

  static async bulkUpdateDeals(ids: string[], updates: any, context: RequestContext) {
    const { error, count } = await supabase
      .from('deals')
      .update({
        ...updates,
        updated_at: new Date(),
      })
      .in('id', ids)
      .eq('workspace_id', context.workspaceId);

    if (error) {
      console.error('Error bulk updating deals:', error);
      throw new Error('Failed to bulk update deals');
    }

    return {
      success: true,
      updatedCount: count || 0,
      failedIds: [],
      errors: [],
    };
  }

  static async getPipelineStats(context: RequestContext) {
    const { data, error } = await supabase
      .from('deals')
      .select('value, stage')
      .eq('workspace_id', context.workspaceId);

    if (error) {
      console.error('Error fetching pipeline stats:', error);
      throw new Error('Failed to fetch pipeline stats');
    }

    const stats = {
      totalValue: 0,
      totalDeals: data.length,
      averageDealSize: 0,
      conversionRate: 0,
      stageValues: {} as Record<string, number>,
    };

    data.forEach(deal => {
      stats.totalValue += deal.value;
      stats.stageValues[deal.stage] = (stats.stageValues[deal.stage] || 0) + deal.value;
    });

    stats.averageDealSize = stats.totalDeals > 0 ? stats.totalValue / stats.totalDeals : 0;

    // Calculate conversion rate (deals in closed_won / total deals)
    const closedWonDeals = data.filter(deal => deal.stage === 'closed_won').length;
    stats.conversionRate = stats.totalDeals > 0 ? closedWonDeals / stats.totalDeals : 0;

    return stats;
  }

  static async getHealthFactors(dealId: string, context: RequestContext) {
    const { data, error } = await supabase
      .from('deal_health_factors')
      .select('*')
      .eq('deal_id', dealId)
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching health factors:', error);
      return [];
    }

    return data;
  }

  static async getProbabilityFactors(dealId: string, context: RequestContext) {
    const { data, error } = await supabase
      .from('deal_probability_factors')
      .select('*')
      .eq('deal_id', dealId)
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching probability factors:', error);
      return [];
    }

    return data;
  }

  static async getTimeline(dealId: string, context: RequestContext) {
    const { data, error } = await supabase
      .from('deal_activities')
      .select('*')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching timeline:', error);
      return [];
    }

    return data;
  }

  static async createActivity(
    dealId: string,
    type: string,
    title: string,
    metadata: any,
    createdBy?: string
  ) {
    const { error } = await supabase
      .from('deal_activities')
      .insert({
        deal_id: dealId,
        type,
        title,
        description: title,
        metadata,
        created_by: createdBy,
        created_at: new Date(),
      });

    if (error) {
      console.error('Error creating activity:', error);
    }
  }

  static async exportDeals(filters: any, format: string, context: RequestContext) {
    // Get deals with filters
    const deals = await this.getDeals({ filter: filters }, context);

    if (format === 'json') {
      return JSON.stringify(deals.edges.map(edge => edge.node), null, 2);
    }

    if (format === 'csv') {
      // Simple CSV export
      const headers = ['id', 'title', 'company', 'contact', 'value', 'stage', 'probability', 'priority', 'created_at'];
      const rows = deals.edges.map(edge => {
        const deal = edge.node;
        return [
          deal.id,
          deal.title || '',
          deal.company,
          deal.contact,
          deal.value,
          deal.stage,
          deal.probability,
          deal.priority,
          deal.createdAt,
        ];
      });

      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    throw new Error(`Unsupported export format: ${format}`);
  }

  static async importDeals(data: any, format: string, context: RequestContext) {
    let deals = [];

    if (format === 'json') {
      deals = JSON.parse(data);
    } else if (format === 'csv') {
      // Simple CSV parsing
      const lines = data.split('\n');
      const headers = lines[0].split(',');
      deals = lines.slice(1).map(line => {
        const values = line.split(',');
        const deal: any = {};
        headers.forEach((header, index) => {
          deal[header] = values[index];
        });
        return deal;
      });
    } else {
      throw new Error(`Unsupported import format: ${format}`);
    }

    const results = [];
    for (const dealData of deals) {
      try {
        const deal = await this.createDeal(dealData, context);
        results.push({ success: true, id: deal.id });
      } catch (error) {
        results.push({ success: false, error: error.message });
      }
    }

    return {
      total: deals.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };
  }
}