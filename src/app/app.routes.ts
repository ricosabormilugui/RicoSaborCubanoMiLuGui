import { Routes } from '@angular/router';
import { CatalogPageComponent } from './features/catalog/catalog-page.component';
import { CartPageComponent } from './features/cart/cart-page.component';
import { CheckoutPageComponent } from './features/checkout/checkout-page.component';
import { ContactPageComponent } from './features/contact/contact-page.component';
import { AdminPageComponent } from './features/admin/admin-page.component';

export const appRoutes: Routes = [
  { path: '', component: CatalogPageComponent },
  { path: 'carrito', component: CartPageComponent },
  { path: 'checkout', component: CheckoutPageComponent },
  { path: 'contacto', component: ContactPageComponent },
  { path: 'admin', component: AdminPageComponent },
  { path: '**', redirectTo: '' }
];
