import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CustomerAuthService } from '../services/customer-auth.service';

export const customerGuard: CanActivateFn = () => inject(CustomerAuthService).isAuthenticated()
  ? true : inject(Router).createUrlTree(['/login']);
