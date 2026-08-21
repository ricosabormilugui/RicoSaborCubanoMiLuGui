import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PRODUCT_CATEGORIES } from '../../core/config/product-categories.config';
import { emptyHomeContent, HomeContent } from '../../core/models/home-content.model';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { AdminHomeService } from '../../core/services/admin-home.service';
import { AdminOrderService } from '../../core/services/admin-order.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-home-page.component.html',
  styleUrls: ['./admin-home-page.component.css']
})
export class AdminHomePageComponent {
  email = '';
  password = '';
  form: HomeContent = emptyHomeContent();

  readonly loading = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly categories = PRODUCT_CATEGORIES;
  readonly brickSlots: Array<{ key: keyof Omit<HomeContent, 'categoryImages'>; label: string; hint: string }> = [
    { key: 'heroImageUrl', label: 'Hero', hint: 'Bloque principal: comida cubana casera y tartas por encargo' },
    { key: 'cubanImageUrl', label: 'Comida cubana', hint: 'Sabor de casa, para pedir cuando quieras' },
    { key: 'cakesImageUrl', label: 'Tartas', hint: 'Cumpleaños, eventos y celebraciones' },
    { key: 'spanishImageUrl', label: 'Comida española', hint: 'Platos para reuniones y mesa familiar' }
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
    this.notice.set('');

    try {
      await this.adminOrders.login(this.email, this.password);
      await this.loadHome();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
    } finally {
      this.loading.set(false);
    }
  }

  logout(): void {
    this.auth.logout();
    this.form = emptyHomeContent();
    this.notice.set('');
    this.error.set('');
  }

  async loadHome(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      this.form = await this.adminHome.getHomeContent();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo cargar la portada.');
    } finally {
      this.loading.set(false);
    }
  }

  async saveHome(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    this.notice.set('');

    try {
      this.form = await this.adminHome.saveHomeContent(this.form);
      this.notice.set('Imágenes de la portada guardadas.');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo guardar la portada.');
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
