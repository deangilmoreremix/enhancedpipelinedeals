interface FeatureFlag {
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage?: number; // 0-100, for gradual rollout
  conditions?: {
    userId?: string[];
    workspaceId?: string[];
    emailDomain?: string[];
  };
}

class FeatureFlagsManager {
  private flags: Map<string, FeatureFlag> = new Map();

  constructor() {
    this.initializeFlags();
  }

  private initializeFlags() {
    // API & Integration Phase 9 flags
    this.flags.set('graphql_api', {
      name: 'GraphQL API',
      description: 'Enable GraphQL API endpoints',
      enabled: true,
    });

    this.flags.set('rest_api', {
      name: 'REST API',
      description: 'Enable REST API endpoints',
      enabled: true,
    });

    this.flags.set('webhooks', {
      name: 'Webhooks',
      description: 'Enable webhook system for real-time notifications',
      enabled: true,
    });

    this.flags.set('integrations', {
      name: 'External Integrations',
      description: 'Enable third-party app integrations',
      enabled: true,
    });

    this.flags.set('data_sync', {
      name: 'Data Synchronization',
      description: 'Enable real-time data synchronization between modules',
      enabled: true,
    });

    this.flags.set('api_documentation', {
      name: 'API Documentation',
      description: 'Enable auto-generated API documentation',
      enabled: true,
    });

    this.flags.set('developer_mode', {
      name: 'Developer Mode',
      description: 'Enable developer-friendly features and debugging',
      enabled: process.env.NODE_ENV === 'development',
    });

    this.flags.set('advanced_permissions', {
      name: 'Advanced Permissions',
      description: 'Enable granular permission system',
      enabled: true,
    });

    this.flags.set('rate_limiting', {
      name: 'Rate Limiting',
      description: 'Enable API rate limiting',
      enabled: true,
    });

    this.flags.set('audit_logging', {
      name: 'Audit Logging',
      description: 'Enable comprehensive API audit logging',
      enabled: true,
    });

    // Phase 10: Security & Compliance features
    this.flags.set('advanced_permissions', {
      name: 'Advanced Permissions',
      description: 'Enable granular permission system with RBAC',
      enabled: true,
      rolloutPercentage: 50, // Gradual rollout
    });

    this.flags.set('role_based_access_control', {
      name: 'Role-Based Access Control',
      description: 'Enable permissions at object, field, and record level',
      enabled: true,
      rolloutPercentage: 50,
    });

    this.flags.set('sso_integration', {
      name: 'SSO Integration',
      description: 'Enable SAML and OIDC authentication',
      enabled: false, // Disabled by default, needs configuration
    });

    this.flags.set('gdpr_compliance', {
      name: 'GDPR Compliance',
      description: 'Enable GDPR compliance features and data retention policies',
      enabled: true,
      rolloutPercentage: 25, // Conservative rollout for compliance features
    });

    this.flags.set('data_export_controls', {
      name: 'Data Export Controls',
      description: 'Enable controlled data export permissions',
      enabled: true,
      rolloutPercentage: 75,
    });

    this.flags.set('data_governance', {
      name: 'Data Governance',
      description: 'Enable secure data handling and retention policies',
      enabled: true,
      rolloutPercentage: 50,
    });

    this.flags.set('audit_trails', {
      name: 'Audit Trails',
      description: 'Enable comprehensive activity logging and compliance reporting',
      enabled: true,
    });

    this.flags.set('security_monitoring', {
      name: 'Security Monitoring',
      description: 'Enable security monitoring and alerting',
      enabled: true,
    });
  }

  isEnabled(flagName: string, context?: any): boolean {
    const flag = this.flags.get(flagName);

    if (!flag) {
      console.warn(`Feature flag '${flagName}' not found`);
      return false;
    }

    if (!flag.enabled) {
      return false;
    }

    // Check rollout percentage
    if (flag.rolloutPercentage !== undefined) {
      if (context?.user?.id) {
        const hash = this.simpleHash(context.user.id);
        const percentage = (hash % 100);
        if (percentage >= flag.rolloutPercentage) {
          return false;
        }
      } else {
        // If no user context, only enable for percentage of anonymous users
        return Math.random() * 100 < flag.rolloutPercentage;
      }
    }

    // Check conditions
    if (flag.conditions) {
      if (flag.conditions.userId && context?.user?.id) {
        if (!flag.conditions.userId.includes(context.user.id)) {
          return false;
        }
      }

      if (flag.conditions.workspaceId && context?.workspaceId) {
        if (!flag.conditions.workspaceId.includes(context.workspaceId)) {
          return false;
        }
      }

      if (flag.conditions.emailDomain && context?.user?.email) {
        const domain = context.user.email.split('@')[1];
        if (!flag.conditions.emailDomain.includes(domain)) {
          return false;
        }
      }
    }

    return true;
  }

  setEnabled(flagName: string, enabled: boolean, options?: {
    rolloutPercentage?: number;
    conditions?: FeatureFlag['conditions'];
  }) {
    const flag = this.flags.get(flagName);
    if (flag) {
      flag.enabled = enabled;
      if (options?.rolloutPercentage !== undefined) {
        flag.rolloutPercentage = options.rolloutPercentage;
      }
      if (options?.conditions) {
        flag.conditions = options.conditions;
      }
    }
  }

  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  getFlag(flagName: string): FeatureFlag | undefined {
    return this.flags.get(flagName);
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

// Export singleton instance
export const featureFlags = new FeatureFlagsManager();

// Export types
export type { FeatureFlag };