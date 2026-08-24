import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideLucideConfig } from '@lucide/angular';
import { appRoutes } from './app/app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(appRoutes),
    provideLucideConfig({
      size: 22,
      strokeWidth: 1.6
    })
  ]
};
