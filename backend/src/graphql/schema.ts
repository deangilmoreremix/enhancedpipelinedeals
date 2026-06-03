import { gql } from 'apollo-server-express';

export const typeDefs = gql`
  # Enums
  enum DealStage {
    qualification
    proposal
    negotiation
    closed_won
    closed_lost
  }

  enum Priority {
    high
    medium
    low
  }

  enum ActivityType {
    created
    updated
    stage_changed
    contact_added
    note_added
    email_sent
    meeting_scheduled
    task_completed
    attachment_added
    link_added
    probability_updated
    health_updated
    bulk_action
  }

  # Input types
  input DealFilter {
    stage: DealStage
    priority: Priority
    assignedToId: String
    company: String
    value_min: Float
    value_max: Float
    probability_min: Float
    probability_max: Float
    createdAfter: DateTime
    createdBefore: DateTime
    tags: [String!]
  }

  input DealSort {
    field: String!
    direction: SortDirection!
  }

  enum SortDirection {
    asc
    desc
  }

  input CreateDealInput {
    title: String
    company: String!
    contact: String!
    contactId: String
    assignedToId: String
    value: Float!
    stage: DealStage!
    probability: Float!
    priority: Priority!
    dueDate: DateTime
    notes: String
    tags: [String!]
    customFields: JSONObject
  }

  input UpdateDealInput {
    id: ID!
    title: String
    company: String
    contact: String
    contactId: String
    assignedToId: String
    value: Float
    stage: DealStage
    probability: Float
    priority: Priority
    dueDate: DateTime
    notes: String
    tags: [String!]
    customFields: JSONObject
  }

  input PaginationInput {
    page: Int
    limit: Int
  }

  # Custom scalars
  scalar DateTime
  scalar JSONObject
  scalar Upload

  # Types
  type Deal {
    id: ID!
    title: String
    company: String!
    contact: String!
    contactId: String
    assignedToId: String
    assignedTo: String
    value: Float!
    stage: DealStage!
    probability: Float!
    priority: Priority!
    dueDate: DateTime
    notes: String
    createdAt: DateTime!
    updatedAt: DateTime!
    contactAvatar: String
    companyAvatar: String
    lastActivity: String
    tags: [String!]
    customFields: JSONObject
    isFavorite: Boolean
    socialProfiles: SocialProfiles
    lastEnrichment: EnrichmentData
    attachments: [Attachment!]
    links: [Link!]
    nextFollowUp: String
    aiScore: Float
    healthScore: Float
    healthFactors: [HealthFactor!]
    winProbability: Float
    probabilityFactors: [ProbabilityFactor!]
    templateId: String
    timeline: [DealActivity!]
    lastHealthUpdate: DateTime
    lastProbabilityUpdate: DateTime
  }

  type SocialProfiles {
    linkedin: String
    twitter: String
    facebook: String
    website: String
  }

  type EnrichmentData {
    confidence: Float!
    aiProvider: String
    timestamp: DateTime
  }

  type Attachment {
    id: String!
    name: String!
    size: Int!
    type: String!
    uploadedAt: String!
  }

  type Link {
    title: String!
    url: String!
    type: String
    createdAt: String
  }

  type HealthFactor {
    id: String!
    name: String!
    category: String!
    score: Float!
    weight: Float!
    description: String!
    isPositive: Boolean!
    timestamp: DateTime!
  }

  type ProbabilityFactor {
    id: String!
    name: String!
    category: String!
    impact: Float!
    confidence: Float!
    description: String!
    data: JSONObject!
    timestamp: DateTime!
  }

  type DealActivity {
    id: String!
    dealId: String!
    type: ActivityType!
    title: String!
    description: String!
    metadata: JSONObject
    createdBy: String
    createdAt: DateTime!
  }

  type Contact {
    id: ID!
    name: String!
    email: String!
    phone: String
    company: String
    position: String
    avatar: String
    socialProfiles: SocialProfiles
    tags: [String!]
    customFields: JSONObject
    createdAt: DateTime!
    updatedAt: DateTime!
    lastActivity: DateTime
  }

  type PipelineStats {
    totalValue: Float!
    totalDeals: Int!
    averageDealSize: Float!
    conversionRate: Float!
    stageValues: JSONObject!
  }

  type DealsConnection {
    edges: [DealEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type DealEdge {
    node: Deal!
    cursor: String!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  type Query {
    # Deal queries
    deal(id: ID!): Deal
    deals(
      filter: DealFilter
      sort: [DealSort!]
      pagination: PaginationInput
      search: String
    ): DealsConnection!

    # Contact queries
    contact(id: ID!): Contact
    contacts(
      filter: JSONObject
      sort: [JSONObject!]
      pagination: PaginationInput
      search: String
    ): ContactsConnection!

    # Pipeline queries
    pipelineStats: PipelineStats!

    # Health check
    health: HealthStatus!
  }

  type ContactsConnection {
    edges: [ContactEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type ContactEdge {
    node: Contact!
    cursor: String!
  }

  type HealthStatus {
    status: String!
    timestamp: DateTime!
    version: String!
    uptime: Float!
  }

  type Mutation {
    # Deal mutations
    createDeal(input: CreateDealInput!): Deal!
    updateDeal(input: UpdateDealInput!): Deal!
    deleteDeal(id: ID!): Boolean!
    bulkUpdateDeals(ids: [ID!]!, updates: JSONObject!): BulkUpdateResult!

    # Contact mutations
    createContact(input: CreateContactInput!): Contact!
    updateContact(input: UpdateContactInput!): Contact!
    deleteContact(id: ID!): Boolean!

    # Webhook mutations
    createWebhook(input: CreateWebhookInput!): Webhook!
    updateWebhook(id: ID!, input: UpdateWebhookInput!): Webhook!
    deleteWebhook(id: ID!): Boolean!
    testWebhook(id: ID!): WebhookTestResult!

    # Integration mutations
    createIntegration(input: CreateIntegrationInput!): Integration!
    updateIntegration(id: ID!, input: UpdateIntegrationInput!): Integration!
    deleteIntegration(id: ID!): Boolean!
    testIntegration(id: ID!): IntegrationTestResult!
  }

  input CreateContactInput {
    name: String!
    email: String!
    phone: String
    company: String
    position: String
    tags: [String!]
    customFields: JSONObject
  }

  input UpdateContactInput {
    id: ID!
    name: String
    email: String
    phone: String
    company: String
    position: String
    tags: [String!]
    customFields: JSONObject
  }

  type BulkUpdateResult {
    success: Boolean!
    updatedCount: Int!
    failedIds: [ID!]
    errors: [String!]
  }

  # Webhook types
  type Webhook {
    id: ID!
    name: String!
    url: String!
    events: [String!]!
    secret: String!
    isActive: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
    lastTriggered: DateTime
    failureCount: Int!
  }

  input CreateWebhookInput {
    name: String!
    url: String!
    events: [String!]!
    secret: String!
  }

  input UpdateWebhookInput {
    name: String
    url: String
    events: [String!]
    secret: String
    isActive: Boolean
  }

  type WebhookTestResult {
    success: Boolean!
    statusCode: Int
    response: String
    error: String
  }

  # Integration types
  type Integration {
    id: ID!
    name: String!
    type: String!
    config: JSONObject!
    isActive: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
    lastSync: DateTime
    syncStatus: String
  }

  input CreateIntegrationInput {
    name: String!
    type: String!
    config: JSONObject!
  }

  input UpdateIntegrationInput {
    name: String
    type: String
    config: JSONObject
    isActive: Boolean
  }

  type IntegrationTestResult {
    success: Boolean!
    message: String!
    data: JSONObject
  }


`;