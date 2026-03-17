import { Routes } from '@angular/router';
import { CatalogPageComponent } from './features/catalog/catalog-page.component';
import { CartPageComponent } from './features/cart/cart-page.component';
import { CheckoutPageComponent } from './features/checkout/checkout-page.component';
import { ContactPageComponent } from './features/contact/contact-page.component';
import { AdminPageComponent } from './features/admin/admin-page.component';
import { AdminProductsPageComponent } from './features/admin/admin-products-page.component';
import { AdminKitchenPageComponent } from './features/admin/admin-kitchen-page.component';
import { LoginPageComponent } from './features/auth/login-page.component';
import { RegisterPageComponent } from './features/auth/register-page.component';
import { MyOrdersPageComponent } from './features/account/my-orders-page.component';
import { adminGuard } from './core/guards/admin.guard';

export const appRoutes: Routes = [
  { path: '', component: CatalogPageComponent },
  { path: 'carrito', component: CartPageComponent },
  { path: 'checkout', component: CheckoutPageComponent },
  { path: 'contacto', component: ContactPageComponent },
  { path: 'admin', component: AdminPageComponent, canActivate: [adminGuard] },
  { path: 'admin/pedidos', component: AdminPageComponent, canActivate: [adminGuard] },
  { path: 'admin/cocina', component: AdminKitchenPageComponent, canActivate: [adminGuard] },
  { path: 'admin/productos', component: AdminProductsPageComponent, canActivate: [adminGuard] },
  { path: 'login', component: LoginPageComponent },
  { path: 'registro', component: RegisterPageComponent },
  { path: 'mis-pedidos', component: MyOrdersPageComponent },
  { path: '**', redirectTo: '' }
];
