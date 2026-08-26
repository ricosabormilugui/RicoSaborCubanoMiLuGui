import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BRAND_CONFIG, getBrandLogo } from '../../core/config/brand.config';
import { HomeContentService } from '../../core/services/home-content.service';
import { ThemeService } from '../../core/services/theme.service';
import { optimizedImageUrl, responsiveImageSrcset } from '../../core/utils/responsive-image';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './auth-layout.component.html',
  styleUrls: ['./auth-layout.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuthLayoutComponent {
  private readonly theme = inject(ThemeService);
  private readonly home = inject(HomeContentService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly desktopVisual = signal(false);

  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly brand = BRAND_CONFIG;
  readonly visualLogo = BRAND_CONFIG.logos.dark;
  readonly brandLogo = computed(() => getBrandLogo(this.theme.mode()));
  readonly visualPhoto = computed(() => {
    if (!this.desktopVisual()) return '';
    const content = this.home.content();
    return content.heroImageUrl || content.cubanImageUrl || content.spanishImageUrl || content.cakesImageUrl;
  });
  readonly visualPhotoSrc = computed(() => optimizedImageUrl(this.visualPhoto(), 1400));
  readonly visualPhotoSrcset = computed(() => responsiveImageSrcset(this.visualPhoto(), [900, 1200, 1600]));

  constructor() {
    const desktop = globalThis.matchMedia?.('(min-width: 1024px)');
    if (!desktop) return;

    this.syncDesktopVisual(desktop.matches);
    const onChange = (event: MediaQueryListEvent) => this.syncDesktopVisual(event.matches);
    desktop.addEventListener('change', onChange);
    this.destroyRef.onDestroy(() => desktop.removeEventListener('change', onChange));
  }

  private syncDesktopVisual(isDesktop: boolean): void {
    this.desktopVisual.set(isDesktop);
    if (isDesktop) void this.home.load();
  }
}
