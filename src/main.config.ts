import { ApplicationConfig } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideLucideConfig } from '@lucide/angular';
import { appRoutes } from './app/app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(appRoutes),
    provideAnimations(),
    provideLucideConfig({
      size: 22,
      strokeWidth: 1.6
    })
  ]
};
