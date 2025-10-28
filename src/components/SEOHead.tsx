import { Helmet } from 'react-helmet-async';
import { SEOConfig } from '../utils/seoHelper';

interface SEOHeadProps {
  config?: Partial<SEOConfig>;
}

const defaultConfig: SEOConfig = {
  title: 'Smart CRM - AI-Powered Sales Pipeline & Contact Management',
  description: 'Boost your sales efficiency by 30% with Smart CRM. AI-powered contact scoring, deal intelligence, psychological profiling, and real-time collaboration.',
  keywords: 'CRM software, sales pipeline management, AI CRM, contact management, deal tracking, sales automation',
  image: 'https://smartcrm.app/og-image.png',
  url: 'https://smartcrm.app',
  type: 'website',
};

export function SEOHead({ config = {} }: SEOHeadProps) {
  const seo = { ...defaultConfig, ...config };

  return (
    <Helmet>
      <title>{seo.title}</title>
      <meta name="description" content={seo.description} />
      {seo.keywords && <meta name="keywords" content={seo.keywords} />}
      {seo.author && <meta name="author" content={seo.author} />}

      <meta property="og:title" content={seo.title} />
      <meta property="og:description" content={seo.description} />
      {seo.image && <meta property="og:image" content={seo.image} />}
      {seo.url && <meta property="og:url" content={seo.url} />}
      {seo.type && <meta property="og:type" content={seo.type} />}

      <meta name="twitter:title" content={seo.title} />
      <meta name="twitter:description" content={seo.description} />
      {seo.image && <meta name="twitter:image" content={seo.image} />}

      {seo.url && <link rel="canonical" href={seo.url} />}

      {seo.publishedTime && (
        <meta property="article:published_time" content={seo.publishedTime} />
      )}
      {seo.modifiedTime && (
        <meta property="article:modified_time" content={seo.modifiedTime} />
      )}
    </Helmet>
  );
}
