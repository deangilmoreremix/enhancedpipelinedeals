import { IResolvers } from '@graphql-tools/utils';
import { DealService } from '../services/dealService';
import { ContactService } from '../services/contactService';
import { WebhookService } from '../webhooks/service';
import { IntegrationService } from '../integrations/service';

export const resolvers: IResolvers = {
  Query: {
    // Deal queries
    deal: async (_: any, { id }: { id: string }, context: any) => {
      return await DealService.getDealById(id, context);
    },

    deals: async (_: any, args: any, context: any) => {
      return await DealService.getDeals(args, context);
    },

    // Contact queries
    contact: async (_: any, { id }: { id: string }, context: any) => {
      return await ContactService.getContactById(id, context);
    },

    contacts: async (_: any, args: any, context: any) => {
      return await ContactService.getContacts(args, context);
    },

    // Pipeline queries
    pipelineStats: async (_: any, args: any, context: any) => {
      return await DealService.getPipelineStats(context);
    },

    // Health check
    health: () => ({
      status: 'healthy',
      timestamp: new Date(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
    }),
  },

  Mutation: {
    // Deal mutations
    createDeal: async (_: any, { input }: any, context: any) => {
      const deal = await DealService.createDeal(input, context);
      return deal;
    },

    updateDeal: async (_: any, { input }: any, context: any) => {
      const deal = await DealService.updateDeal(input, context);
      return deal;
    },

    deleteDeal: async (_: any, { id }: { id: string }, context: any) => {
      const result = await DealService.deleteDeal(id, context);
      return result;
    },

    bulkUpdateDeals: async (_: any, { ids, updates }: any, context: any) => {
      return await DealService.bulkUpdateDeals(ids, updates, context);
    },

    // Contact mutations
    createContact: async (_: any, { input }: any, context: any) => {
      const contact = await ContactService.createContact(input, context);
      return contact;
    },

    updateContact: async (_: any, { input }: any, context: any) => {
      const contact = await ContactService.updateContact(input, context);
      return contact;
    },

    deleteContact: async (_: any, { id }: { id: string }, context: any) => {
      const result = await ContactService.deleteContact(id, context);
      return result;
    },

    // Webhook mutations
    createWebhook: async (_: any, { input }: any, context: any) => {
      return await WebhookService.createWebhook(input, context);
    },

    updateWebhook: async (_: any, { id, input }: any, context: any) => {
      return await WebhookService.updateWebhook(id, input, context);
    },

    deleteWebhook: async (_: any, { id }: { id: string }, context: any) => {
      return await WebhookService.deleteWebhook(id, context);
    },

    testWebhook: async (_: any, { id }: { id: string }, context: any) => {
      return await WebhookService.testWebhook(id, context);
    },

    // Integration mutations
    createIntegration: async (_: any, { input }: any, context: any) => {
      return await IntegrationService.createIntegration(input, context);
    },

    updateIntegration: async (_: any, { id, input }: any, context: any) => {
      return await IntegrationService.updateIntegration(id, input, context);
    },

    deleteIntegration: async (_: any, { id }: { id: string }, context: any) => {
      return await IntegrationService.deleteIntegration(id, context);
    },

    testIntegration: async (_: any, { id }: { id: string }, context: any) => {
      return await IntegrationService.testIntegration(id, context);
    },
  },



  // Field resolvers
  Deal: {
    assignedTo: async (deal: any, _: any, context: any) => {
      if (deal.assignedToId) {
        const user = await ContactService.getContactById(deal.assignedToId, context);
        return user?.name;
      }
      return null;
    },

    healthFactors: async (deal: any, _: any, context: any) => {
      return await DealService.getHealthFactors(deal.id, context);
    },

    probabilityFactors: async (deal: any, _: any, context: any) => {
      return await DealService.getProbabilityFactors(deal.id, context);
    },

    timeline: async (deal: any, _: any, context: any) => {
      return await DealService.getTimeline(deal.id, context);
    },
  },

  Contact: {
    // Add any field resolvers for Contact if needed
  },
};