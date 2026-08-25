import siteConfig from '../../shared/site.config.json';

export const environment = {
  production: false,
  apiUrl: 'http://localhost:3001',
  siteUrl: siteConfig.productionSiteUrl
};
