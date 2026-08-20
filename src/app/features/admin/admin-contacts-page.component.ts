import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { AdminOrderService } from '../../core/services/admin-order.service';
import { AdminContact, AdminContactStatus } from '../../core/models/admin-contact.model';
import { AdminContactService } from '../../core/services/admin-contact.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="card" *ngIf="!auth.isAuthenticated(); else panel">
      <h1>Acceso administrador</h1>
      <div class="grid two">
        <input [(ngModel)]="email" placeholder="Email admin" />
        <input [(ngModel)]="password" type="password" placeholder="Contraseña" />
      </div>
      <button class="btn btn-primary" (click)="login()" [disabled]="loading()">{{ loading() ? 'Iniciando sesión...' : 'Iniciar sesión' }}</button>
      <p class="err" *ngIf="error()">{{ error() }}</p>
    </section>

    <ng-template #panel>
      <section class="card">
        <div class="toolbar">
          <h1>📩 CRM · Contactos</h1>
          <div class="actions">
            <select [(ngModel)]="statusFilter" (change)="loadContacts()">
              <option value="">Todos</option>
              <option value="nuevo">Nuevo</option>
              <option value="leido">Leído</option>
              <option value="respondido">Respondido</option>
            </select>
            <input [(ngModel)]="search" (keyup.enter)="loadContacts()" placeholder="Buscar nombre/teléfono/email" />
            <button class="btn" (click)="loadContacts()">Buscar</button>
            <button class="btn" routerLink="/admin/dashboard">Dashboard</button>
            <button class="btn" routerLink="/admin/pedidos">Pedidos</button>
            <button class="btn" routerLink="/admin/clientes">Clientes</button>
            <button class="btn" routerLink="/admin/productos">Productos</button>
            <button class="btn" (click)="logout()">Salir</button>
          </div>
        </div>

        <p class="ok" *ngIf="notice()">{{ notice() }}</p>
        <p class="err" *ngIf="error()">{{ error() }}</p>

        <div class="crm-grid">
          <aside class="inbox">
            <article
              class="contact-item"
              [class.active]="selectedId() === item.id"
              *ngFor="let item of contacts()"
              (click)="openContact(item.id)">
              <header>
                <strong>{{ item.name }}</strong>
                <span class="badge" [class]="'badge ' + item.status">{{ item.status }}</span>
              </header>
              <p>{{ item.phone || 'sin teléfono' }} · {{ item.email || 'sin email' }}</p>
              <p class="meta">Mensajes: {{ item.messages.length }} · {{ item.createdAt | date:'short' }}</p>
            </article>
          </aside>

          <section class="detail" *ngIf="selectedContact(); else emptyDetail">
            <h2>{{ selectedContact()?.name }}</h2>
            <p class="meta">{{ selectedContact()?.phone || 'sin teléfono' }} · {{ selectedContact()?.email || 'sin email' }}</p>

            <div class="chat">
              <div class="bubble" *ngFor="let msg of selectedContact()?.messages" [class.admin]="msg.from === 'admin'">
                <small>{{ msg.from }} · {{ msg.date | date:'short' }}</small>
                <p>{{ msg.text }}</p>
              </div>
            </div>

            <div class="reply-box">
              <textarea [(ngModel)]="replyMessage" placeholder="Escribe una respuesta al cliente..."></textarea>
              <label><input type="checkbox" [(ngModel)]="sendEmail" /> Enviar email</label>
              <button class="btn btn-primary" (click)="sendReply()" [disabled]="sendingReply()">{{ sendingReply() ? 'Enviando...' : 'Responder' }}</button>
            </div>
          </section>

          <ng-template #emptyDetail>
            <section class="detail empty">Selecciona un contacto para ver conversación.</section>
          </ng-template>
        </div>
      </section>
    </ng-template>
  `,
  styles: [
    `.grid{display:grid;gap:.7rem;margin-bottom:.7rem}`,
    `.grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}`,
    `.toolbar{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap}`,
    `.actions{display:flex;gap:.5rem;flex-wrap:wrap}`,
    `.crm-grid{display:grid;grid-template-columns:340px 1fr;gap:.9rem;margin-top:.8rem}`,
    `.inbox{max-height:70vh;overflow:auto;border:1px solid var(--border-soft);border-radius:12px;padding:.5rem;background:var(--surface-1)}`,
    `.contact-item{background:var(--surface-0);border:1px solid var(--border-soft);border-radius:10px;padding:.55rem;margin-bottom:.5rem;cursor:pointer;color:var(--text-main)}`,
    `.contact-item.active{border-color:var(--accent-red);background:color-mix(in srgb, var(--accent-red) 10%, var(--surface-0))}`,
    `.contact-item header{display:flex;justify-content:space-between;align-items:center;gap:.45rem}`,
    `.badge{padding:.2rem .5rem;border-radius:999px;color:var(--on-accent);font-size:.75rem;text-transform:capitalize}`,
    `.badge.nuevo{background:var(--contact-new-bg)}`,
    `.badge.leido{background:var(--contact-read-bg)}`,
    `.badge.respondido{background:var(--contact-answered-bg)}`,
    `.detail{border:1px solid var(--border-soft);border-radius:12px;padding:.8rem;background:var(--surface-0);color:var(--text-main)}`,
    `.detail.empty{display:grid;place-items:center;color:var(--text-soft)}`,
    `.meta{color:var(--text-soft);font-size:.85rem}`,
    `.chat{display:grid;gap:.5rem;max-height:48vh;overflow:auto;padding:.6rem;border:1px solid var(--border-soft);border-radius:10px;background:var(--surface-1)}`,
    `.bubble{background:var(--surface-0);border:1px solid var(--border-soft);border-radius:10px;padding:.5rem;color:var(--text-main)}`,
    `.bubble.admin{background:color-mix(in srgb, var(--accent-green) 14%, var(--surface-0));border-color:color-mix(in srgb, var(--accent-green) 35%, var(--border-soft))}`,
    `.bubble p{margin:.3rem 0 0;white-space:pre-line}`,
    `.reply-box{display:grid;gap:.5rem;margin-top:.7rem}`,
    `.reply-box textarea{min-height:90px;padding:.6rem;border:1px solid var(--border-soft);border-radius:8px;background:var(--surface-1);color:var(--text-main)}`,
    `.ok{color:var(--ok-text);white-space:pre-line}`,
    `.err{color:var(--error-text);white-space:pre-line}`,
    `@media (max-width:980px){.crm-grid{grid-template-columns:1fr}.grid.two{grid-template-columns:1fr}}`
  ]
})
export class AdminContactsPageComponent {
  email = '';
  password = '';
  search = '';
  statusFilter: '' | AdminContactStatus = '';
  replyMessage = '';
  sendEmail = true;

  readonly loading = signal(false);
  readonly sendingReply = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly contacts = signal<AdminContact[]>([]);
  readonly selectedId = signal('');
  readonly selectedContact = signal<AdminContact | null>(null);

  constructor(
    public readonly auth: AdminAuthService,
    private readonly adminOrders: AdminOrderService,
    private readonly adminContacts: AdminContactService
  ) {
    if (this.auth.isAuthenticated()) {
      void this.loadContacts();
    }
  }

  async login(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    this.notice.set('');

    try {
      await this.adminOrders.login(this.email, this.password);
      await this.loadContacts();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
    } finally {
      this.loading.set(false);
    }
  }

  logout(): void {
    this.auth.logout();
    this.contacts.set([]);
    this.selectedContact.set(null);
    this.selectedId.set('');
  }

  async loadContacts(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const contacts = await this.adminContacts.listContacts(this.statusFilter || undefined, this.search || undefined);
      this.contacts.set(contacts);
      if (this.selectedId()) {
        const exists = contacts.find((contact) => contact.id === this.selectedId());
        if (!exists) {
          this.selectedId.set('');
          this.selectedContact.set(null);
        }
      }
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudieron cargar contactos.');
    } finally {
      this.loading.set(false);
    }
  }

  async openContact(id: string): Promise<void> {
    this.error.set('');
    this.notice.set('');
    this.selectedId.set(id);

    try {
      const contact = await this.adminContacts.getContact(id);
      this.selectedContact.set(contact);
      this.syncContactWithActiveFilter(contact);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo abrir el contacto.');
    }
  }

  async sendReply(): Promise<void> {
    const contact = this.selectedContact();
    if (!contact) return;

    this.notice.set('');
    this.error.set('');
    this.sendingReply.set(true);

    try {
      const result = await this.adminContacts.replyContact(contact.id, this.replyMessage, this.sendEmail);
      this.selectedContact.set(result.contact);
      this.syncContactWithActiveFilter(result.contact);

      const emailLine = result.notifications.email.sent
        ? '📧 Respuesta enviada por email'
        : `⚠️ Email no enviado: ${result.notifications.email.warning ?? 'sin detalle'}`;

      this.notice.set(`✅ Respuesta guardada\n${emailLine}`);
      this.replyMessage = '';
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo responder el contacto.');
    } finally {
      this.sendingReply.set(false);
    }
  }

  private syncContactWithActiveFilter(contact: AdminContact): void {
    this.contacts.update((current) => {
      if (this.statusFilter && contact.status !== this.statusFilter) {
        return current.filter((item) => item.id !== contact.id);
      }

      return current.map((item) => item.id === contact.id ? contact : item);
    });
  }
}
