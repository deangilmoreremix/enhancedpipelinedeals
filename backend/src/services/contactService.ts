import { supabase } from '../services/database';
import { Contact, RequestContext } from '../types';

export class ContactService {
  static async getContactById(id: string, context: RequestContext): Promise<Contact | null> {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .eq('workspace_id', context.workspaceId)
      .single();

    if (error) {
      console.error('Error fetching contact:', error);
      return null;
    }

    return data;
  }

  static async getContacts(
    args: {
      filter?: any;
      sort?: any[];
      pagination?: any;
      search?: string;
    },
    context: RequestContext
  ) {
    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .eq('workspace_id', context.workspaceId);

    // Apply filters
    if (args.filter) {
      if (args.filter.email) query = query.ilike('email', `%${args.filter.email}%`);
      if (args.filter.company) query = query.ilike('company', `%${args.filter.company}%`);
      if (args.filter.position) query = query.ilike('position', `%${args.filter.position}%`);
      if (args.filter.tags && args.filter.tags.length > 0) {
        query = query.overlaps('tags', args.filter.tags);
      }
      if (args.filter.createdAfter) query = query.gte('created_at', args.filter.createdAfter);
      if (args.filter.createdBefore) query = query.lte('created_at', args.filter.createdBefore);
    }

    // Apply search
    if (args.search) {
      query = query.or(`name.ilike.%${args.search}%,email.ilike.%${args.search}%,company.ilike.%${args.search}%`);
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
      console.error('Error fetching contacts:', error);
      throw new Error('Failed to fetch contacts');
    }

    return {
      edges: data.map(contact => ({ node: contact, cursor: contact.id })),
      pageInfo: {
        hasNextPage: args.pagination ? ((args.pagination.page || 1) * (args.pagination.limit || 20)) < (count || 0) : false,
        hasPreviousPage: (args.pagination?.page || 1) > 1,
        startCursor: data.length > 0 ? data[0].id : null,
        endCursor: data.length > 0 ? data[data.length - 1].id : null,
      },
      totalCount: count || 0,
    };
  }

  static async createContact(input: any, context: RequestContext): Promise<Contact> {
    const contactData = {
      ...input,
      workspace_id: context.workspaceId,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const { data, error } = await supabase
      .from('contacts')
      .insert(contactData)
      .select()
      .single();

    if (error) {
      console.error('Error creating contact:', error);
      throw new Error('Failed to create contact');
    }

    return data;
  }

  static async updateContact(input: any, context: RequestContext): Promise<Contact> {
    const { id, ...updates } = input;

    const { data, error } = await supabase
      .from('contacts')
      .update({
        ...updates,
        updated_at: new Date(),
      })
      .eq('id', id)
      .eq('workspace_id', context.workspaceId)
      .select()
      .single();

    if (error) {
      console.error('Error updating contact:', error);
      throw new Error('Failed to update contact');
    }

    return data;
  }

  static async deleteContact(id: string, context: RequestContext): Promise<boolean> {
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', id)
      .eq('workspace_id', context.workspaceId);

    if (error) {
      console.error('Error deleting contact:', error);
      return false;
    }

    return true;
  }

  static async searchContacts(searchTerm: string, context: RequestContext): Promise<Contact[]> {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('workspace_id', context.workspaceId)
      .or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,company.ilike.%${searchTerm}%`)
      .limit(10);

    if (error) {
      console.error('Error searching contacts:', error);
      return [];
    }

    return data;
  }

  static async getContactsByCompany(company: string, context: RequestContext): Promise<Contact[]> {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('workspace_id', context.workspaceId)
      .ilike('company', `%${company}%`);

    if (error) {
      console.error('Error fetching contacts by company:', error);
      return [];
    }

    return data;
  }

  static async getContactStats(context: RequestContext) {
    const { data, error } = await supabase
      .from('contacts')
      .select('company')
      .eq('workspace_id', context.workspaceId);

    if (error) {
      console.error('Error fetching contact stats:', error);
      throw new Error('Failed to fetch contact stats');
    }

    const companyCounts = data.reduce((acc, contact) => {
      const company = contact.company || 'Unknown';
      acc[company] = (acc[company] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalContacts: data.length,
      companyDistribution: companyCounts,
      topCompanies: Object.entries(companyCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5),
    };
  }
}