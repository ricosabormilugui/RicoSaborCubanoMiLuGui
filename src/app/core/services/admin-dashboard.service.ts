import { Injectable } from '@angular/core';
import { resolveApiBaseUrl } from '../config/api.config';
import { AdminDashboardData } from '../models/admin-dashboard.model';
import { AdminAuthService } from './admin-auth.service';

@Injectable({ providedIn: 'root' })
export class AdminDashboardService {
  private readonly apiBase = resolveApiBaseUrl();

  constructor(private readonly auth: AdminAuthService) {}

  async getDashboard(days = 14): Promise<AdminDashboardData> {
    const query = new URLSearchParams({ days: String(days) });
    const response = await fetch(`${this.apiBase}/admin/dashboard?${query.toString()}`, {
      headers: { Authorization: `Bearer ${this.auth.token()}` }
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        this.auth.logout();
      }
      throw new Error('No fue posible cargar el dashboard.');
    }

    return (await response.json()) as AdminDashboardData;
  }
}
