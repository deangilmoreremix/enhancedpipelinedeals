import { DealDetailState, DealDetailAction } from './types';
import { Deal } from '../../types';
import { Contact } from '../../types/contact';

export const initialDealDetailState = (deal: Deal, contactData?: Contact | null): DealDetailState => ({
  activeTab: 'overview',
  isEditing: false,
  editedDeal: deal,
  linkedContact: contactData || null,
  isAnalyzing: false,
  isSaving: false,
  isEnriching: false,
  lastEnrichment: null,
  editingField: null,
  showAddField: false,
  newFieldName: '',
  newFieldValue: '',
  showAddSocial: false,
  selectedSocialPlatform: '',
  socialFieldValue: '',
  showAddSource: false,
  addSource: '',
  editInterestLevel: false,
  showContactSelector: false,
  newTag: '',
  showAddLink: false,
  newLinkTitle: '',
  newLinkUrl: '',
  files: [],
  activeModal: null,
  isRunningSDR: false,

  // Phase 3 enhancements
  showBulkActions: false,
  selectedDeals: [],
  healthRefreshing: false,
  probabilityRefreshing: false,

  // Phase 1: Enhanced Activities Foundation
  activities: [],
  activitiesLoading: false,
  activitiesError: null,
  activityFilter: {
    limit: 50,
    offset: 0
  },
  activityComments: {},
  realtimeSyncVersion: 0,
  activitySubscriptions: [],
  showActivityFilters: false,
  selectedActivities: [],
  isCreatingActivity: false,
  activityTemplates: []
});

export const dealDetailReducer = (state: DealDetailState, action: DealDetailAction): DealDetailState => {
  switch (action.type) {
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };

    case 'SET_EDITING':
      return { ...state, isEditing: action.payload };

    case 'UPDATE_EDITED_DEAL':
      return {
        ...state,
        editedDeal: { ...state.editedDeal, ...action.payload }
      };

    case 'SET_LINKED_CONTACT':
      return { ...state, linkedContact: action.payload };

    case 'SET_ANALYZING':
      return { ...state, isAnalyzing: action.payload };

    case 'SET_SAVING':
      return { ...state, isSaving: action.payload };

    case 'SET_ENRICHING':
      return { ...state, isEnriching: action.payload };

    case 'SET_LAST_ENRICHMENT':
      return { ...state, lastEnrichment: action.payload };

    case 'SET_EDITING_FIELD':
      return { ...state, editingField: action.payload };

    case 'SET_SHOW_ADD_FIELD':
      return { ...state, showAddField: action.payload };

    case 'SET_NEW_FIELD_NAME':
      return { ...state, newFieldName: action.payload };

    case 'SET_NEW_FIELD_VALUE':
      return { ...state, newFieldValue: action.payload };

    case 'SET_SHOW_ADD_SOCIAL':
      return { ...state, showAddSocial: action.payload };

    case 'SET_SELECTED_SOCIAL_PLATFORM':
      return { ...state, selectedSocialPlatform: action.payload };

    case 'SET_SOCIAL_FIELD_VALUE':
      return { ...state, socialFieldValue: action.payload };

    case 'SET_SHOW_ADD_SOURCE':
      return { ...state, showAddSource: action.payload };

    case 'SET_ADD_SOURCE':
      return { ...state, addSource: action.payload };

    case 'SET_EDIT_INTEREST_LEVEL':
      return { ...state, editInterestLevel: action.payload };

    case 'SET_SHOW_CONTACT_SELECTOR':
      return { ...state, showContactSelector: action.payload };

    case 'SET_NEW_TAG':
      return { ...state, newTag: action.payload };

    case 'SET_SHOW_ADD_LINK':
      return { ...state, showAddLink: action.payload };

    case 'SET_NEW_LINK_TITLE':
      return { ...state, newLinkTitle: action.payload };

    case 'SET_NEW_LINK_URL':
      return { ...state, newLinkUrl: action.payload };

    case 'SET_FILES':
      return { ...state, files: action.payload };

    case 'SET_ACTIVE_MODAL':
      return { ...state, activeModal: action.payload };

    case 'SET_RUNNING_SDR':
      return { ...state, isRunningSDR: action.payload };

    case 'SET_SHOW_BULK_ACTIONS':
      return { ...state, showBulkActions: action.payload };

    case 'SET_SELECTED_DEALS':
      return { ...state, selectedDeals: action.payload };

    case 'SET_HEALTH_REFRESHING':
      return { ...state, healthRefreshing: action.payload };

    case 'SET_PROBABILITY_REFRESHING':
      return { ...state, probabilityRefreshing: action.payload };

    // Phase 1: Enhanced Activities Actions
    case 'SET_ACTIVITIES':
      return { ...state, activities: action.payload };

    case 'ADD_ACTIVITY':
      return { ...state, activities: [action.payload, ...state.activities] };

    case 'UPDATE_ACTIVITY':
      return {
        ...state,
        activities: state.activities.map(activity =>
          activity.id === action.payload.id
            ? { ...activity, ...action.payload.updates }
            : activity
        )
      };

    case 'DELETE_ACTIVITY':
      return {
        ...state,
        activities: state.activities.filter(activity => activity.id !== action.payload)
      };

    case 'SET_ACTIVITIES_LOADING':
      return { ...state, activitiesLoading: action.payload };

    case 'SET_ACTIVITIES_ERROR':
      return { ...state, activitiesError: action.payload };

    case 'SET_ACTIVITY_FILTER':
      return { ...state, activityFilter: { ...state.activityFilter, ...action.payload } };

    case 'SET_ACTIVITY_COMMENTS':
      return {
        ...state,
        activityComments: {
          ...state.activityComments,
          [action.payload.activityId]: action.payload.comments
        }
      };

    case 'ADD_ACTIVITY_COMMENT':
      const existingComments = state.activityComments[action.payload.activityId] || [];
      return {
        ...state,
        activityComments: {
          ...state.activityComments,
          [action.payload.activityId]: [...existingComments, action.payload.comment]
        }
      };

    case 'SET_REALTIME_SYNC_VERSION':
      return { ...state, realtimeSyncVersion: action.payload };

    case 'SET_ACTIVITY_SUBSCRIPTIONS':
      return { ...state, activitySubscriptions: action.payload };

    case 'SET_SHOW_ACTIVITY_FILTERS':
      return { ...state, showActivityFilters: action.payload };

    case 'SET_SELECTED_ACTIVITIES':
      return { ...state, selectedActivities: action.payload };

    case 'SET_CREATING_ACTIVITY':
      return { ...state, isCreatingActivity: action.payload };

    case 'SET_ACTIVITY_TEMPLATES':
      return { ...state, activityTemplates: action.payload };

    case 'RESET_STATE':
      return initialDealDetailState(action.payload.deal, action.payload.contactData);

    default:
      return state;
  }
};

// Action creators for cleaner usage
export const dealDetailActions = {
  setActiveTab: (tabId: string): DealDetailAction => ({
    type: 'SET_ACTIVE_TAB',
    payload: tabId
  }),

  setEditing: (isEditing: boolean): DealDetailAction => ({
    type: 'SET_EDITING',
    payload: isEditing
  }),

  updateEditedDeal: (updates: Partial<Deal>): DealDetailAction => ({
    type: 'UPDATE_EDITED_DEAL',
    payload: updates
  }),

  setLinkedContact: (contact: Contact | null): DealDetailAction => ({
    type: 'SET_LINKED_CONTACT',
    payload: contact
  }),

  setAnalyzing: (isAnalyzing: boolean): DealDetailAction => ({
    type: 'SET_ANALYZING',
    payload: isAnalyzing
  }),

  setSaving: (isSaving: boolean): DealDetailAction => ({
    type: 'SET_SAVING',
    payload: isSaving
  }),

  setEnriching: (isEnriching: boolean): DealDetailAction => ({
    type: 'SET_ENRICHING',
    payload: isEnriching
  }),

  setLastEnrichment: (enrichment: any): DealDetailAction => ({
    type: 'SET_LAST_ENRICHMENT',
    payload: enrichment
  }),

  setEditingField: (field: string | null): DealDetailAction => ({
    type: 'SET_EDITING_FIELD',
    payload: field
  }),

  setShowAddField: (show: boolean): DealDetailAction => ({
    type: 'SET_SHOW_ADD_FIELD',
    payload: show
  }),

  setNewFieldName: (name: string): DealDetailAction => ({
    type: 'SET_NEW_FIELD_NAME',
    payload: name
  }),

  setNewFieldValue: (value: string): DealDetailAction => ({
    type: 'SET_NEW_FIELD_VALUE',
    payload: value
  }),

  setShowAddSocial: (show: boolean): DealDetailAction => ({
    type: 'SET_SHOW_ADD_SOCIAL',
    payload: show
  }),

  setSelectedSocialPlatform: (platform: string): DealDetailAction => ({
    type: 'SET_SELECTED_SOCIAL_PLATFORM',
    payload: platform
  }),

  setSocialFieldValue: (value: string): DealDetailAction => ({
    type: 'SET_SOCIAL_FIELD_VALUE',
    payload: value
  }),

  setShowAddSource: (show: boolean): DealDetailAction => ({
    type: 'SET_SHOW_ADD_SOURCE',
    payload: show
  }),

  setAddSource: (source: string): DealDetailAction => ({
    type: 'SET_ADD_SOURCE',
    payload: source
  }),

  setEditInterestLevel: (edit: boolean): DealDetailAction => ({
    type: 'SET_EDIT_INTEREST_LEVEL',
    payload: edit
  }),

  setShowContactSelector: (show: boolean): DealDetailAction => ({
    type: 'SET_SHOW_CONTACT_SELECTOR',
    payload: show
  }),

  setNewTag: (tag: string): DealDetailAction => ({
    type: 'SET_NEW_TAG',
    payload: tag
  }),

  setShowAddLink: (show: boolean): DealDetailAction => ({
    type: 'SET_SHOW_ADD_LINK',
    payload: show
  }),

  setNewLinkTitle: (title: string): DealDetailAction => ({
    type: 'SET_NEW_LINK_TITLE',
    payload: title
  }),

  setNewLinkUrl: (url: string): DealDetailAction => ({
    type: 'SET_NEW_LINK_URL',
    payload: url
  }),

  setFiles: (files: any[]): DealDetailAction => ({
    type: 'SET_FILES',
    payload: files
  }),

  setActiveModal: (modal: any): DealDetailAction => ({
    type: 'SET_ACTIVE_MODAL',
    payload: modal
  }),

  setRunningSDR: (isRunning: boolean): DealDetailAction => ({
    type: 'SET_RUNNING_SDR',
    payload: isRunning
  }),

  setShowBulkActions: (show: boolean): DealDetailAction => ({
    type: 'SET_SHOW_BULK_ACTIONS',
    payload: show
  }),

  setSelectedDeals: (deals: Deal[]): DealDetailAction => ({
    type: 'SET_SELECTED_DEALS',
    payload: deals
  }),

  setHealthRefreshing: (refreshing: boolean): DealDetailAction => ({
    type: 'SET_HEALTH_REFRESHING',
    payload: refreshing
  }),

  setProbabilityRefreshing: (refreshing: boolean): DealDetailAction => ({
    type: 'SET_PROBABILITY_REFRESHING',
    payload: refreshing
  }),

  // Phase 1: Enhanced Activities Actions
  setActivities: (activities: any[]): DealDetailAction => ({
    type: 'SET_ACTIVITIES',
    payload: activities
  }),

  addActivity: (activity: any): DealDetailAction => ({
    type: 'ADD_ACTIVITY',
    payload: activity
  }),

  updateActivity: (id: string, updates: any): DealDetailAction => ({
    type: 'UPDATE_ACTIVITY',
    payload: { id, updates }
  }),

  deleteActivity: (id: string): DealDetailAction => ({
    type: 'DELETE_ACTIVITY',
    payload: id
  }),

  setActivitiesLoading: (loading: boolean): DealDetailAction => ({
    type: 'SET_ACTIVITIES_LOADING',
    payload: loading
  }),

  setActivitiesError: (error: string | null): DealDetailAction => ({
    type: 'SET_ACTIVITIES_ERROR',
    payload: error
  }),

  setActivityFilter: (filter: any): DealDetailAction => ({
    type: 'SET_ACTIVITY_FILTER',
    payload: filter
  }),

  setActivityComments: (activityId: string, comments: any[]): DealDetailAction => ({
    type: 'SET_ACTIVITY_COMMENTS',
    payload: { activityId, comments }
  }),

  addActivityComment: (activityId: string, comment: any): DealDetailAction => ({
    type: 'ADD_ACTIVITY_COMMENT',
    payload: { activityId, comment }
  }),

  setRealtimeSyncVersion: (version: number): DealDetailAction => ({
    type: 'SET_REALTIME_SYNC_VERSION',
    payload: version
  }),

  setActivitySubscriptions: (subscriptions: any[]): DealDetailAction => ({
    type: 'SET_ACTIVITY_SUBSCRIPTIONS',
    payload: subscriptions
  }),

  setShowActivityFilters: (show: boolean): DealDetailAction => ({
    type: 'SET_SHOW_ACTIVITY_FILTERS',
    payload: show
  }),

  setSelectedActivities: (activityIds: string[]): DealDetailAction => ({
    type: 'SET_SELECTED_ACTIVITIES',
    payload: activityIds
  }),

  setCreatingActivity: (creating: boolean): DealDetailAction => ({
    type: 'SET_CREATING_ACTIVITY',
    payload: creating
  }),

  setActivityTemplates: (templates: any[]): DealDetailAction => ({
    type: 'SET_ACTIVITY_TEMPLATES',
    payload: templates
  }),

  resetState: (deal: Deal, contactData?: Contact | null): DealDetailAction => ({
    type: 'RESET_STATE',
    payload: { deal, contactData }
  })
};