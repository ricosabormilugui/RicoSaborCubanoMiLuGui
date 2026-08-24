import brandConfig from '../../../../shared/brand.config.json';
import { ThemeMode } from '../services/theme.service';

export const BRAND_CONFIG = brandConfig;

export function getBrandLogo(theme: ThemeMode): string {
  return theme === 'dark' ? BRAND_CONFIG.logos.dark : BRAND_CONFIG.logos.light;
}
