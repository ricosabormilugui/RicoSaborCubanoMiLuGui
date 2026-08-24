import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';
import { SeoMetaInput } from './core/services/seo.service';
import { BRAND_CONFIG } from './core/config/brand.config';

const privateSeo = (title: string, description: string, canonicalPath: string): SeoMetaInput => ({
  title,
  description,
  canonicalPath,
  robots: 'noindex,nofollow'
});

export const appRoutes: Routes = [
  { path: '', loadComponent: () => import('./features/home/home-page.component').then((m) => m.HomePageComponent) },
  { path: 'productos', loadComponent: () => import('./features/catalog/catalog-page.component').then((m) => m.CatalogPageComponent) },
  { path: 'categoria/:category', loadComponent: () => import('./features/catalog/catalog-page.component').then((m) => m.CatalogPageComponent) },
  {
    path: 'producto/:slug',
    loadComponent: () => import('./features/catalog/product-detail-page.component').then((m) => m.ProductDetailPageComponent)
  },
  {
    path: 'carrito',
    loadComponent: () => import('./features/cart/cart-page.component').then((m) => m.CartPageComponent),
    data: { seo: privateSeo('Carrito', 'Revisa los productos de tu carrito antes de continuar.', '/carrito') }
  },
  {
    path: 'checkout',
    loadComponent: () => import('./features/checkout/checkout-page.component').then((m) => m.CheckoutPageComponent),
    data: { seo: privateSeo('Checkout', 'Finaliza de forma privada los datos de entrega y tu solicitud de pedido.', '/checkout') }
  },
  {
    path: 'contacto',
    loadComponent: () => import('./features/contact/contact-page.component').then((m) => m.ContactPageComponent),
    data: { seo: { title: 'Contacto', description: `Contacta con ${BRAND_CONFIG.name} para consultar productos, tartas, encargos, entregas o recogidas.`, canonicalPath: '/contacto' } }
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
    canActivate: [adminGuard],
    data: { seo: privateSeo('Administración', `Área privada de administración de ${BRAND_CONFIG.name}.`, '/admin') }
  },
  {
    path: 'admin/dashboard',
    loadComponent: () => import('./features/admin/admin-dashboard-page.component').then((m) => m.AdminDashboardPageComponent),
    canActivate: [adminGuard],
    data: { seo: privateSeo('Dashboard de administración', `Panel privado de métricas de ${BRAND_CONFIG.name}.`, '/admin/dashboard') }
  },
  {
    path: 'admin/pedidos',
    loadComponent: () => import('./features/admin/admin-page.component').then((m) => m.AdminPageComponent),
    canActivate: [adminGuard],
    data: { seo: privateSeo('Pedidos · Administración', `Gestión privada de pedidos de ${BRAND_CONFIG.name}.`, '/admin/pedidos') }
  },
  {
    path: 'admin/cocina',
    loadComponent: () => import('./features/admin/admin-kitchen-page.component').then((m) => m.AdminKitchenPageComponent),
    canActivate: [adminGuard],
    data: { seo: privateSeo('Cocina · Administración', `Panel privado de cocina de ${BRAND_CONFIG.name}.`, '/admin/cocina') }
  },
  {
    path: 'admin/contactos',
    loadComponent: () => import('./features/admin/admin-contacts-page.component').then((m) => m.AdminContactsPageComponent),
    canActivate: [adminGuard],
    data: { seo: privateSeo('Contactos · Administración', `Gestión privada de contactos de ${BRAND_CONFIG.name}.`, '/admin/contactos') }
  },
  {
    path: 'admin/clientes',
    loadComponent: () => import('./features/admin/admin-customers-page.component').then((m) => m.AdminCustomersPageComponent),
    canActivate: [adminGuard],
    data: { seo: privateSeo('Clientes · Administración', `Gestión privada de clientes de ${BRAND_CONFIG.name}.`, '/admin/clientes') }
  },
  {
    path: 'admin/productos',
    loadComponent: () => import('./features/admin/admin-products-page.component').then((m) => m.AdminProductsPageComponent),
    canActivate: [adminGuard],
    data: { seo: privateSeo('Productos · Administración', `Gestión privada del catálogo de ${BRAND_CONFIG.name}.`, '/admin/productos') }
  },
  {
    path: 'admin/portada',
    loadComponent: () => import('./features/admin/admin-home-page.component').then((m) => m.AdminHomePageComponent),
    canActivate: [adminGuard],
    data: { seo: privateSeo('Portada · Administración', `Gestión privada de la portada de ${BRAND_CONFIG.name}.`, '/admin/portada') }
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login-page.component').then((m) => m.LoginPageComponent),
    data: { seo: privateSeo('Iniciar sesión', `Acceso privado a tu cuenta de ${BRAND_CONFIG.name}.`, '/login') }
  },
  {
    path: 'registro',
    loadComponent: () => import('./features/auth/register-page.component').then((m) => m.RegisterPageComponent),
    data: { seo: privateSeo('Crear cuenta', `Registro privado de clientes de ${BRAND_CONFIG.name}.`, '/registro') }
  },
  {
    path: 'recuperar-contrasena',
    loadComponent: () => import('./features/auth/forgot-password-page.component').then((m) => m.ForgotPasswordPageComponent),
    data: { seo: privateSeo('Recuperar contraseña', `Solicita de forma privada la recuperación de tu cuenta de ${BRAND_CONFIG.name}.`, '/recuperar-contrasena') }
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./features/auth/reset-password-page.component').then((m) => m.ResetPasswordPageComponent),
    data: { seo: privateSeo('Nueva contraseña', `Define de forma privada una nueva contraseña para tu cuenta de ${BRAND_CONFIG.name}.`, '/reset-password') }
  },
  {
    path: 'mis-pedidos',
    loadComponent: () => import('./features/account/my-orders-page.component').then((m) => m.MyOrdersPageComponent),
    data: { seo: privateSeo('Mis pedidos', `Consulta privada de pedidos asociados a tu cuenta de ${BRAND_CONFIG.name}.`, '/mis-pedidos') }
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found-page.component').then((m) => m.NotFoundPageComponent),
    data: {
      seo: {
        title: 'Página no encontrada',
        description: `La página solicitada no existe o ya no está disponible en ${BRAND_CONFIG.name}.`,
        canonicalPath: '/404',
        robots: 'noindex,follow'
      }
    }
  }
];
