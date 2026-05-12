import { Routes } from '@angular/router';
import { CatalogPageComponent } from './features/catalog/catalog-page.component';
import { adminGuard } from './core/guards/admin.guard';

export const appRoutes: Routes = [
  { path: '', component: CatalogPageComponent },
  { path: 'categoria/:category', component: CatalogPageComponent },
  {
    path: 'producto/:slug',
    loadComponent: () => import('./features/catalog/product-detail-page.component').then((m) => m.ProductDetailPageComponent)
  },
  {
    path: 'carrito',
    loadComponent: () => import('./features/cart/cart-page.component').then((m) => m.CartPageComponent)
  },
  {
    path: 'checkout',
    loadComponent: () => import('./features/checkout/checkout-page.component').then((m) => m.CheckoutPageComponent)
  },
  {
    path: 'contacto',
    loadComponent: () => import('./features/contact/contact-page.component').then((m) => m.ContactPageComponent)
  },
  { path: 'legal', redirectTo: 'legal/aviso-legal', pathMatch: 'full' },
  {
    path: 'legal/:slug',
    loadComponent: () => import('./features/legal/legal-page.component').then((m) => m.LegalPageComponent)
  },
  { path: 'aviso-legal', redirectTo: 'legal/aviso-legal', pathMatch: 'full' },
  { path: 'privacidad', redirectTo: 'legal/privacidad', pathMatch: 'full' },
  { path: 'cookies', redirectTo: 'legal/cookies', pathMatch: 'full' },
  { path: 'condiciones-compra', redirectTo: 'legal/condiciones-compra', pathMatch: 'full' },
  { path: 'envios', redirectTo: 'legal/envios', pathMatch: 'full' },
  { path: 'devoluciones-cancelaciones', redirectTo: 'legal/devoluciones-cancelaciones', pathMatch: 'full' },
  {
    path: 'admin',
    loadComponent: () => import('./features/admin/admin-page.component').then((m) => m.AdminPageComponent),
    canActivate: [adminGuard]
  },
  {
    path: 'admin/dashboard',
    loadComponent: () => import('./features/admin/admin-dashboard-page.component').then((m) => m.AdminDashboardPageComponent),
    canActivate: [adminGuard]
  },
  {
    path: 'admin/pedidos',
    loadComponent: () => import('./features/admin/admin-page.component').then((m) => m.AdminPageComponent),
    canActivate: [adminGuard]
  },
  {
    path: 'admin/cocina',
    loadComponent: () => import('./features/admin/admin-kitchen-page.component').then((m) => m.AdminKitchenPageComponent),
    canActivate: [adminGuard]
  },
  {
    path: 'admin/contactos',
    loadComponent: () => import('./features/admin/admin-contacts-page.component').then((m) => m.AdminContactsPageComponent),
    canActivate: [adminGuard]
  },
  {
    path: 'admin/clientes',
    loadComponent: () => import('./features/admin/admin-customers-page.component').then((m) => m.AdminCustomersPageComponent),
    canActivate: [adminGuard]
  },
  {
    path: 'admin/productos',
    loadComponent: () => import('./features/admin/admin-products-page.component').then((m) => m.AdminProductsPageComponent),
    canActivate: [adminGuard]
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login-page.component').then((m) => m.LoginPageComponent)
  },
  {
    path: 'registro',
    loadComponent: () => import('./features/auth/register-page.component').then((m) => m.RegisterPageComponent)
  },
  {
    path: 'mis-pedidos',
    loadComponent: () => import('./features/account/my-orders-page.component').then((m) => m.MyOrdersPageComponent)
  },
  { path: '**', redirectTo: '' }
];
