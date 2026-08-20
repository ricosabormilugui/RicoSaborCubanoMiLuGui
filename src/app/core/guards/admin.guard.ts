import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CustomerAuthService } from '../services/customer-auth.service';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(CustomerAuthService);
  const router = inject(Router);

  return auth.profile()?.role === 'admin' ? true : router.createUrlTree(['/login']);
};
