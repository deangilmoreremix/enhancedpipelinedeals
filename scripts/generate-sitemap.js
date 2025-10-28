import { writeFileSync } from 'fs';
import { join } from 'path';

const baseUrl = 'https://smartcrm.app';
const currentDate = new Date().toISOString().split('T')[0];

const routes = [
  { path: '/', changefreq: 'daily', priority: 1.0 },
  { path: '/features', changefreq: 'weekly', priority: 0.9 },
  { path: '/pricing', changefreq: 'weekly', priority: 0.9 },
  { path: '/docs', changefreq: 'weekly', priority: 0.8 },
  { path: '/docs/getting-started', changefreq: 'monthly', priority: 0.8 },
  { path: '/features/ai-scoring', changefreq: 'monthly', priority: 0.7 },
  { path: '/features/pipeline-management', changefreq: 'monthly', priority: 0.7 },
  { path: '/features/contact-management', changefreq: 'monthly', priority: 0.7 },
  { path: '/features/analytics', changefreq: 'monthly', priority: 0.7 },
  { path: '/features/gamification', changefreq: 'monthly', priority: 0.7 },
  { path: '/about', changefreq: 'monthly', priority: 0.6 },
  { path: '/blog', changefreq: 'weekly', priority: 0.7 },
  { path: '/contact', changefreq: 'monthly', priority: 0.6 },
  { path: '/faq', changefreq: 'monthly', priority: 0.6 },
  { path: '/privacy', changefreq: 'yearly', priority: 0.3 },
  { path: '/terms', changefreq: 'yearly', priority: 0.3 },
];

function generateSitemap() {
  const urls = routes
    .map(
      (route) => `
  <url>
    <loc>${baseUrl}${route.path}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`
    )
    .join('');

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">${urls}
</urlset>`;

  return sitemap;
}

const sitemap = generateSitemap();
const distPath = join(process.cwd(), 'dist', 'sitemap.xml');
const publicPath = join(process.cwd(), 'public', 'sitemap.xml');

try {
  writeFileSync(publicPath, sitemap);
  console.log('✅ Sitemap generated successfully at public/sitemap.xml');

  try {
    writeFileSync(distPath, sitemap);
    console.log('✅ Sitemap copied to dist/sitemap.xml');
  } catch (distError) {
    console.log('ℹ️  dist directory not found, skipping dist copy');
  }
} catch (error) {
  console.error('❌ Error generating sitemap:', error);
  process.exit(1);
}
