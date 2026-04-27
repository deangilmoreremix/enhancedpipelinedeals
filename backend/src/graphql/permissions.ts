// Simple permission checker function
export const checkPermissions = (user: any, operation: string, resource?: any) => {
  // If no user, deny access
  if (!user) {
    return false;
  }

  // Admin has access to everything
  if (user.role === 'admin') {
    return true;
  }

  // For non-admin users, check specific permissions
  switch (operation) {
    case 'query':
      // All authenticated users can query
      return true;

    case 'create':
      // All authenticated users can create
      return true;

    case 'update':
    case 'delete':
      // Only resource owners or admins can update/delete
      if (resource) {
        return resource.assignedToId === user.id || resource.createdBy === user.id;
      }
      return false;

    case 'admin':
      // Admin-only operations
      return user.role === 'admin';

    default:
      return false;
  }
};

// Placeholder for future permissions middleware
export const permissions = null;

// Admin rule
const isAdmin = rule()((parent, args, context) => {
  return context.user?.role === 'admin';
});

// Owner rule - check if user owns the resource
const isOwner = rule()(async (parent, args, context) => {
  const { user } = context;

  if (!user) return false;

  // For deal operations
  if (args.id || args.input?.id) {
    const dealId = args.id || args.input?.id;
    // Check if user is assigned to the deal or is admin
    const deal = await context.dataSources.dealService.getDealById(dealId);
    return deal?.assignedToId === user.id || user.role === 'admin';
  }

  // For contact operations
  if (args.contactId || args.input?.id) {
    const contactId = args.contactId || args.input?.id;
    // Check if user created the contact or is admin
    const contact = await context.dataSources.contactService.getContactById(contactId);
    return contact?.createdBy === user.id || user.role === 'admin';
  }

  return true;
});

// Workspace member rule
const isWorkspaceMember = rule()((parent, args, context) => {
  return Boolean(context.user?.workspaceId);
});

export const permissions = shield({
  Query: {
    // Public queries
    health: shield.Pass,

    // Authenticated queries
    deal: isAuthenticated,
    deals: isAuthenticated,
    contact: isAuthenticated,
    contacts: isAuthenticated,
    pipelineStats: isAuthenticated,
  },

  Mutation: {
    // Deal mutations - authenticated users can create
    createDeal: isAuthenticated,
    updateDeal: isOwner, // Only owners or admins can update
    deleteDeal: isOwner, // Only owners or admins can delete
    bulkUpdateDeals: isAuthenticated, // Allow authenticated users for bulk operations

    // Contact mutations
    createContact: isAuthenticated,
    updateContact: isOwner,
    deleteContact: isOwner,

    // Webhook mutations - admin only
    createWebhook: isAdmin,
    updateWebhook: isAdmin,
    deleteWebhook: isAdmin,
    testWebhook: isAdmin,

    // Integration mutations - admin only
    createIntegration: isAdmin,
    updateIntegration: isAdmin,
    deleteIntegration: isAdmin,
    testIntegration: isAdmin,
  },

  Subscription: {
    // All subscriptions require authentication
    dealUpdated: isAuthenticated,
    dealCreated: isAuthenticated,
    contactUpdated: isAuthenticated,
    contactCreated: isAuthenticated,
    webhookTriggered: isAuthenticated,
  },
}, {
  // Default fallback
  fallbackRule: isAuthenticated,

  // Error handling
  fallbackError: new Error('Not authorized'),

  // Allow external errors
  allowExternalErrors: true,
});