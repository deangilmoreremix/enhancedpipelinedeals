import { supabase } from './database';
import { SSOConfig, SAMLConfig, OIDCConfig } from '../types';
import { featureFlags } from '../features/flags';
import jwt from 'jsonwebtoken';

export class SSOService {
  /**
   * Create SSO configuration for a workspace
   */
  async createSSOConfig(
    workspaceId: string,
    provider: 'saml' | 'oidc' | 'google' | 'microsoft' | 'okta',
    config: SAMLConfig | OIDCConfig,
    createdBy: string
  ): Promise<SSOConfig> {
    if (!featureFlags.isEnabled('sso_integration')) {
      throw new Error('SSO integration is not enabled');
    }

    const ssoConfig: SSOConfig = {
      id: crypto.randomUUID(),
      workspaceId,
      provider,
      config,
      isActive: false, // Disabled by default until configured
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { error } = await supabase
      .from('sso_configs')
      .insert([{
        id: ssoConfig.id,
        workspace_id: ssoConfig.workspaceId,
        provider: ssoConfig.provider,
        config: ssoConfig.config,
        is_active: ssoConfig.isActive,
        created_by: ssoConfig.createdBy,
        created_at: ssoConfig.createdAt.toISOString(),
        updated_at: ssoConfig.updatedAt.toISOString(),
      }]);

    if (error) throw error;
    return ssoConfig;
  }

  /**
   * Get SSO configuration for a workspace
   */
  async getSSOConfig(workspaceId: string): Promise<SSOConfig | null> {
    const { data, error } = await supabase
      .from('sso_configs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .single();

    if (error) return null;

    return {
      id: data.id,
      workspaceId: data.workspace_id,
      provider: data.provider,
      config: data.config,
      isActive: data.is_active,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  /**
   * Update SSO configuration
   */
  async updateSSOConfig(
    configId: string,
    updates: Partial<Pick<SSOConfig, 'config' | 'isActive'>>
  ): Promise<void> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.config) updateData.config = updates.config;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

    const { error } = await supabase
      .from('sso_configs')
      .update(updateData)
      .eq('id', configId);

    if (error) throw error;
  }

  /**
   * Delete SSO configuration
   */
  async deleteSSOConfig(configId: string): Promise<void> {
    const { error } = await supabase
      .from('sso_configs')
      .delete()
      .eq('id', configId);

    if (error) throw error;
  }

  /**
   * Generate SAML metadata for IdP configuration
   */
  generateSAMLMetadata(config: SAMLConfig, baseUrl: string): string {
    const entityId = config.entityId;
    const acsUrl = `${baseUrl}/api/auth/sso/saml/acs`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityId}">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acsUrl}" index="0" isDefault="true"/>
  </SPSSODescriptor>
</EntityDescriptor>`;
  }

  /**
   * Handle SAML authentication response
   */
  async handleSAMLResponse(
    samlResponse: string,
    config: SAMLConfig,
    workspaceId: string
  ): Promise<any> {
    // This is a simplified implementation
    // In production, you would use a proper SAML library like passport-saml

    try {
      // Decode and parse SAML response
      const decodedResponse = Buffer.from(samlResponse, 'base64').toString();
      const userInfo = this.parseSAMLAssertion(decodedResponse);

      // Create or update user
      const user = await this.createOrUpdateUserFromSSO(userInfo, workspaceId, 'saml');

      return user;
    } catch (error) {
      throw new Error('Failed to process SAML response');
    }
  }

  /**
   * Handle OIDC authentication callback
   */
  async handleOIDCAuth(
    code: string,
    config: OIDCConfig,
    workspaceId: string,
    redirectUri: string
  ): Promise<any> {
    try {
      // Exchange code for tokens
      const tokenResponse = await this.exchangeOIDCCode(code, config, redirectUri);
      const userInfo = await this.getOIDCUserInfo(tokenResponse.access_token, config);

      // Create or update user
      const user = await this.createOrUpdateUserFromSSO(userInfo, workspaceId, 'oidc');

      return user;
    } catch (error) {
      throw new Error('Failed to process OIDC authentication');
    }
  }

  /**
   * Handle Google OAuth authentication
   */
  async handleGoogleAuth(
    code: string,
    workspaceId: string,
    redirectUri: string
  ): Promise<any> {
    try {
      // Exchange code for tokens using Google's OAuth endpoint
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const tokens = await tokenResponse.json();

      // Get user info from Google
      const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      const userInfo = await userResponse.json();

      // Create or update user
      const user = await this.createOrUpdateUserFromSSO({
        email: userInfo.email,
        name: userInfo.name,
        given_name: userInfo.given_name,
        family_name: userInfo.family_name,
        picture: userInfo.picture,
      }, workspaceId, 'google');

      return user;
    } catch (error) {
      throw new Error('Failed to process Google authentication');
    }
  }

  /**
   * Handle Microsoft OAuth authentication
   */
  async handleMicrosoftAuth(
    code: string,
    workspaceId: string,
    redirectUri: string
  ): Promise<any> {
    try {
      // Similar to Google auth but using Microsoft endpoints
      const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.MICROSOFT_CLIENT_ID!,
          client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const tokens = await tokenResponse.json();

      const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      const userInfo = await userResponse.json();

      const user = await this.createOrUpdateUserFromSSO({
        email: userInfo.mail || userInfo.userPrincipalName,
        name: userInfo.displayName,
        given_name: userInfo.givenName,
        family_name: userInfo.surname,
      }, workspaceId, 'microsoft');

      return user;
    } catch (error) {
      throw new Error('Failed to process Microsoft authentication');
    }
  }

  /**
   * Exchange OIDC authorization code for tokens
   */
  private async exchangeOIDCCode(
    code: string,
    config: OIDCConfig,
    redirectUri: string
  ): Promise<any> {
    const response = await fetch(config.tokenEndpoint || `${config.issuer}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });

    return response.json();
  }

  /**
   * Get user info from OIDC provider
   */
  private async getOIDCUserInfo(accessToken: string, config: OIDCConfig): Promise<any> {
    const response = await fetch(config.userinfoEndpoint || `${config.issuer}/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return response.json();
  }

  /**
   * Parse SAML assertion (simplified implementation)
   */
  private parseSAMLAssertion(samlXml: string): any {
    // This is a simplified implementation
    // In production, use a proper SAML parsing library

    // Extract basic user info from SAML response
    const emailMatch = samlXml.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/);
    const attributes: any = {};

    // Extract attribute statements
    const attributeMatches = samlXml.matchAll(/<saml:Attribute[^>]*Name="([^"]*)"[^>]*>(.*?)<\/saml:Attribute>/g);
    for (const match of attributeMatches) {
      const name = match[1];
      const valueMatch = match[2].match(/<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>/);
      if (valueMatch) {
        attributes[name] = valueMatch[1];
      }
    }

    return {
      email: emailMatch ? emailMatch[1] : attributes.email,
      name: attributes.displayName || attributes.name,
      given_name: attributes.givenName,
      family_name: attributes.surname,
      ...attributes,
    };
  }

  /**
   * Create or update user from SSO authentication
   */
  private async createOrUpdateUserFromSSO(
    userInfo: any,
    workspaceId: string,
    provider: string
  ): Promise<any> {
    // Check if user exists
    let { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', userInfo.email)
      .single();

    if (!existingUser) {
      // Create new user
      const { data: newUser, error } = await supabase
        .from('users')
        .insert([{
          email: userInfo.email,
          name: userInfo.name,
          avatar: userInfo.picture,
          workspace_id: workspaceId,
          sso_provider: provider,
          sso_id: userInfo.sub || userInfo.email,
          created_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) throw error;
      existingUser = newUser;
    } else {
      // Update existing user with SSO info
      await supabase
        .from('users')
        .update({
          name: userInfo.name,
          avatar: userInfo.picture,
          sso_provider: provider,
          sso_id: userInfo.sub || userInfo.email,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingUser.id);
    }

    return existingUser;
  }

  /**
   * Generate JWT token for authenticated user
   */
  generateAuthToken(user: any): string {
    const payload = {
      id: user.id,
      email: user.email,
      workspaceId: user.workspace_id,
      role: user.role || 'user',
    };

    return jwt.sign(payload, process.env.JWT_SECRET || 'fallback-secret', {
      expiresIn: '24h',
    });
  }
}

export const ssoService = new SSOService();