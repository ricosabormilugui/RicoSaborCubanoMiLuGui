import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CustomerAuthService } from '../services/customer-auth.service';

export const customerGuard: CanActivateFn = (_route, state) => {
  const auth = inject(CustomerAuthService);
  if (auth.isAuthenticated()) return true;
  return inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

export const blockAdminFavoritesGuard: CanActivateFn = () => {
  const auth = inject(CustomerAuthService);
  if (auth.isAdminAccount()) return inject(Router).createUrlTree(['/productos']);
  return true;
};
