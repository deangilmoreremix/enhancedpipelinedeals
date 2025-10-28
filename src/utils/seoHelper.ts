export interface SEOConfig {
  title: string;
  description: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'product';
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
}

const defaultSEO: SEOConfig = {
  title: 'Smart CRM - AI-Powered Sales Pipeline & Contact Management',
  description: 'Boost your sales efficiency by 30% with Smart CRM. AI-powered contact scoring, deal intelligence, psychological profiling, and real-time collaboration.',
  keywords: 'CRM software, sales pipeline management, AI CRM, contact management, deal tracking, sales automation',
  image: 'https://smartcrm.app/og-image.png',
  url: 'https://smartcrm.app',
  type: 'website',
};

export function updateMetaTags(config: Partial<SEOConfig>) {
  const seo = { ...defaultSEO, ...config };

  document.title = seo.title;

  updateOrCreateMetaTag('name', 'description', seo.description);
  updateOrCreateMetaTag('name', 'keywords', seo.keywords || '');

  if (seo.author) {
    updateOrCreateMetaTag('name', 'author', seo.author);
  }

  updateOrCreateMetaTag('property', 'og:title', seo.title);
  updateOrCreateMetaTag('property', 'og:description', seo.description);
  updateOrCreateMetaTag('property', 'og:image', seo.image || '');
  updateOrCreateMetaTag('property', 'og:url', seo.url || '');
  updateOrCreateMetaTag('property', 'og:type', seo.type || 'website');

  updateOrCreateMetaTag('name', 'twitter:title', seo.title);
  updateOrCreateMetaTag('name', 'twitter:description', seo.description);
  updateOrCreateMetaTag('name', 'twitter:image', seo.image || '');

  if (seo.publishedTime) {
    updateOrCreateMetaTag('property', 'article:published_time', seo.publishedTime);
  }

  if (seo.modifiedTime) {
    updateOrCreateMetaTag('property', 'article:modified_time', seo.modifiedTime);
  }

  updateCanonicalUrl(seo.url || '');
}

function updateOrCreateMetaTag(attribute: string, attributeValue: string, content: string) {
  let element = document.querySelector(`meta[${attribute}="${attributeValue}"]`);

  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, attributeValue);
    document.head.appendChild(element);
  }

  element.setAttribute('content', content);
}

function updateCanonicalUrl(url: string) {
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;

  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }

  link.href = url;
}

export const seoConfigs = {
  home: {
    title: 'Smart CRM - AI-Powered Sales Pipeline & Contact Management',
    description: 'Boost your sales efficiency by 30% with Smart CRM. AI-powered contact scoring, deal intelligence, psychological profiling, and real-time collaboration.',
    keywords: 'CRM software, sales pipeline management, AI CRM, contact management, deal tracking',
    url: 'https://smartcrm.app',
  },
  features: {
    title: 'Features - Smart CRM | AI-Powered CRM Tools',
    description: 'Explore Smart CRM features: AI scoring, pipeline management, contact intelligence, analytics, gamification, and real-time collaboration for sales teams.',
    keywords: 'CRM features, AI contact scoring, pipeline management, sales analytics, team collaboration',
    url: 'https://smartcrm.app/features',
  },
  aiScoring: {
    title: 'AI Contact Scoring - Smart CRM',
    description: 'Automatically score and prioritize leads with AI-powered contact scoring. Psychological profiling, behavioral insights, and win probability analysis.',
    keywords: 'AI lead scoring, contact scoring, lead prioritization, psychological profiling, sales AI',
    url: 'https://smartcrm.app/features/ai-scoring',
  },
  pipelineManagement: {
    title: 'Pipeline Management - Smart CRM',
    description: 'Manage your sales pipeline with multiple views: Kanban, List, Table, Calendar, Dashboard, and Timeline. Drag-and-drop deal management.',
    keywords: 'sales pipeline, kanban board, deal management, pipeline visualization, sales tracking',
    url: 'https://smartcrm.app/features/pipeline-management',
  },
  contactManagement: {
    title: 'Contact Management - Smart CRM',
    description: 'Advanced contact management with AI insights, journey timeline, behavioral analysis, and automated enrichment. Build better customer relationships.',
    keywords: 'contact management, CRM contacts, customer database, contact insights, relationship management',
    url: 'https://smartcrm.app/features/contact-management',
  },
  analytics: {
    title: 'Sales Analytics - Smart CRM',
    description: 'Data-driven sales insights with comprehensive analytics. Track revenue, conversion rates, pipeline health, and team performance metrics.',
    keywords: 'sales analytics, revenue tracking, conversion rates, sales metrics, performance analytics',
    url: 'https://smartcrm.app/features/analytics',
  },
  gamification: {
    title: 'Sales Gamification - Smart CRM',
    description: 'Motivate your sales team with achievements, leaderboards, and challenges. Track performance, celebrate wins, and drive engagement.',
    keywords: 'sales gamification, team motivation, achievements, leaderboard, sales competition',
    url: 'https://smartcrm.app/features/gamification',
  },
  pricing: {
    title: 'Pricing - Smart CRM',
    description: 'Simple, transparent pricing for teams of all sizes. Start with a free trial and scale as you grow. No hidden fees.',
    keywords: 'CRM pricing, sales software cost, CRM plans, free trial, subscription pricing',
    url: 'https://smartcrm.app/pricing',
  },
  docs: {
    title: 'Documentation - Smart CRM',
    description: 'Comprehensive documentation, guides, and tutorials for Smart CRM. Learn how to maximize your sales efficiency with our platform.',
    keywords: 'CRM documentation, user guide, tutorials, help center, CRM setup',
    url: 'https://smartcrm.app/docs',
  },
  about: {
    title: 'About Us - Smart CRM',
    description: 'Learn about Smart CRM, our mission to empower sales teams with AI-powered tools, and our commitment to customer success.',
    keywords: 'about Smart CRM, company information, our mission, sales software company',
    url: 'https://smartcrm.app/about',
  },
  contact: {
    title: 'Contact Us - Smart CRM',
    description: 'Get in touch with Smart CRM. Request a demo, ask questions, or learn how we can help transform your sales process.',
    keywords: 'contact Smart CRM, request demo, customer support, sales inquiry',
    url: 'https://smartcrm.app/contact',
  },
};

export function generateStructuredData(type: 'organization' | 'software' | 'breadcrumb', data?: any) {
  const scripts: Record<string, any> = {
    organization: {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Smart CRM',
      url: 'https://smartcrm.app',
      logo: 'https://smartcrm.app/logo.png',
      description: 'AI-powered CRM platform for modern sales teams',
      sameAs: [
        'https://twitter.com/smartcrm',
        'https://linkedin.com/company/smartcrm',
        'https://facebook.com/smartcrm',
      ],
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'Customer Service',
        email: 'support@smartcrm.app',
        availableLanguage: ['English'],
      },
    },
    software: {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Smart CRM',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web Browser',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        description: 'Free trial available',
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.8',
        ratingCount: '250',
      },
      description: 'AI-powered CRM with contact scoring, deal intelligence, psychological profiling, and real-time collaboration for sales teams',
      featureList: [
        'AI-Powered Contact Scoring',
        'Deal Pipeline Management',
        'Psychological Profiling',
        'Real-Time Collaboration',
        'Sales Analytics',
        'Gamification',
        'Email Integration',
        'Multiple View Modes',
      ],
    },
    breadcrumb: data || {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: 'https://smartcrm.app',
        },
      ],
    },
  };

  return scripts[type];
}

export function injectStructuredData(type: 'organization' | 'software' | 'breadcrumb', data?: any) {
  const scriptId = `structured-data-${type}`;
  let script = document.getElementById(scriptId);

  if (!script) {
    script = document.createElement('script');
    script.id = scriptId;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }

  script.textContent = JSON.stringify(generateStructuredData(type, data));
}
