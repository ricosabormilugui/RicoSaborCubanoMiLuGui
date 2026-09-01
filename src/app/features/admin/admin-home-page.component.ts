import { NotificationService } from '../../core/services/notification.service';
import { getUserFriendlyError } from '../../core/utils/user-friendly-error';
import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { emptyHomeContent, HomeContent } from '../../core/models/home-content.model';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { AdminHomeService } from '../../core/services/admin-home.service';
import { AdminOrderService } from '../../core/services/admin-order.service';
import { ProductCategoryService } from '../../core/services/product-category.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-home-page.component.html',
  styleUrls: ['./admin-home-page.component.css']
})
export class AdminHomePageComponent {
  private readonly notifications = inject(NotificationService);
  private readonly productCategories = inject(ProductCategoryService);
  email = '';
  password = '';
  form: HomeContent = emptyHomeContent();

  readonly loading = signal(false);
  readonly error = signal('');
  readonly categories = this.productCategories.categories;
  readonly brickSlots: Array<{ key: keyof Omit<HomeContent, 'categoryImages'>; label: string; hint: string }> = [
    { key: 'heroImageUrl', label: 'Hero', hint: 'Bloque principal · 1600×1000 (16:10)' },
    { key: 'cubanImageUrl', label: 'Comida cubana', hint: 'Sabor de casa · 1600×1000 (16:10)' },
    { key: 'cakesImageUrl', label: 'Tartas', hint: 'Celebraciones · 1600×1000 (16:10)' },
    { key: 'spanishImageUrl', label: 'Comida española', hint: 'Mesa familiar · 1600×1000 (16:10)' }
  ];

  constructor(
    public readonly auth: AdminAuthService,
    private readonly adminOrders: AdminOrderService,
    private readonly adminHome: AdminHomeService
  ) {
    if (this.auth.isAuthenticated()) {
      void this.loadHome();
    }
  }

  async login(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      await this.adminOrders.login(this.email, this.password);
      await this.loadHome();
    } catch (error) {
      this.error.set(getUserFriendlyError(error, 'No se pudo iniciar sesión.'));
    } finally {
      this.loading.set(false);
    }
  }

  logout(): void {
    this.auth.logout();
    this.form = emptyHomeContent();
    this.error.set('');
  }

  async loadHome(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const [home] = await Promise.all([
        this.adminHome.getHomeContent(),
        this.productCategories.loadAdminCategories()
      ]);
      this.form = home;
    } catch (error) {
      this.error.set(getUserFriendlyError(error, 'No se pudo cargar la portada.'));
    } finally {
      this.loading.set(false);
    }
  }

  async saveHome(): Promise<void> {
    if (this.loading()) return;
    const id = this.notifications.loading('Guardando portada…', undefined, { key: 'home-save' });
    this.loading.set(true);
    this.error.set('');

    try {
      this.form = await this.adminHome.saveHomeContent(this.form);
      this.notifications.updateSuccess(id, 'Portada guardada');
    } catch (error) {
      this.notifications.updateError(id, 'No se pudo guardar la portada', getUserFriendlyError(error));
    } finally {
      this.loading.set(false);
    }
  }

  slotValue(key: keyof Omit<HomeContent, 'categoryImages'>): string {
    return this.form[key];
  }

  setSlotValue(key: keyof Omit<HomeContent, 'categoryImages'>, value: string): void {
    this.form[key] = value;
  }
}
