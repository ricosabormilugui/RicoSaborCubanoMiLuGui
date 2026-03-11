import { Routes } from '@angular/router';
import { CatalogPageComponent } from './features/catalog/catalog-page.component';
import { CartPageComponent } from './features/cart/cart-page.component';
import { CheckoutPageComponent } from './features/checkout/checkout-page.component';
import { ContactPageComponent } from './features/contact/contact-page.component';
import { AdminPageComponent } from './features/admin/admin-page.component';
import { LoginPageComponent } from './features/auth/login-page.component';
import { RegisterPageComponent } from './features/auth/register-page.component';
import { MyOrdersPageComponent } from './features/account/my-orders-page.component';

export const appRoutes: Routes = [
  { path: '', component: CatalogPageComponent },
  { path: 'carrito', component: CartPageComponent },
  { path: 'checkout', component: CheckoutPageComponent },
  { path: 'contacto', component: ContactPageComponent },
  { path: 'admin', component: AdminPageComponent },
  { path: 'login', component: LoginPageComponent },
  { path: 'registro', component: RegisterPageComponent },
  { path: 'mis-pedidos', component: MyOrdersPageComponent },
  { path: '**', redirectTo: '' }
];
