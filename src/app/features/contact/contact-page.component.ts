import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ContactFormPayload, ContactService } from '../../core/services/contact.service';
import { environment } from '../../../environments/environment';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="contact-shell">
      <article class="card contact-card">
        <header class="head">
          <p class="eyebrow">Soporte inmediato</p>
          <h1>Solicitar información</h1>
          <p class="sub">Déjanos tus datos y te responderemos por WhatsApp o email.</p>
        </header>

        <form [formGroup]="form" (ngSubmit)="submit()" class="contact-form">
          <input class="input" formControlName="name" placeholder="Nombre" />
          <input class="input" formControlName="phone" placeholder="Teléfono" />
          <input class="input" formControlName="email" placeholder="Email" />
          <textarea class="input" formControlName="message" placeholder="¿Cómo te ayudamos?"></textarea>

          <button class="btn btn-primary" type="submit" [disabled]="form.invalid || sending()">
            <span *ngIf="!sending()">Enviar solicitud</span>
            <span *ngIf="sending()" class="spinner" aria-label="Enviando"></span>
          </button>
        </form>

        <div class="app-alert app-alert-success" *ngIf="notice()">
          <strong>✅ Solicitud enviada</strong>
          <span>{{ notice() }}</span>
        </div>

        <div class="app-alert app-alert-error" *ngIf="error()">
          <strong>❌ No se pudo enviar</strong>
          <span>{{ error() }}</span>
        </div>

        <p class="meta" *ngIf="lastContactId()">ID de solicitud: {{ lastContactId() }}</p>
        <button class="btn btn-secondary" *ngIf="canRetry()" (click)="retryLastSubmission()" [disabled]="sending()">Reintentar</button>
      </article>
    </section>
  `,
  styles: [
    `.contact-shell{display:grid;place-items:center;padding:1rem 0}`,
    `.contact-card{width:min(760px,100%);background:linear-gradient(180deg,#ffffff 0%,#f8fbff 100%);border:1px solid #e6edf8}`,
    `.head{margin-bottom:.8rem}`,
    `.eyebrow{margin:0;color:#1d4ed8;font-weight:700;font-size:.8rem;letter-spacing:.3px;text-transform:uppercase}`,
    `.head h1{margin:.2rem 0 .35rem}`,
    `.sub{margin:0;color:#475569}`,
    `.contact-form{display:grid;gap:.72rem}`,
    `.input{border:1px solid #d6deea;border-radius:12px;padding:12px;width:100%;transition:all .2s;background:#fff}`,
    `.input:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.16);outline:none}`,
    `.input::placeholder{color:#94a3b8}`,
    `textarea.input{min-height:120px;resize:vertical}`,
    `.app-alert{display:grid;gap:.22rem;white-space:pre-line}`,
    `.meta{color:#475467;font-size:.88rem;margin-top:.35rem}`,
    `.spinner{width:18px;height:18px;border:2px solid rgba(255,255,255,.95);border-top-color:transparent;border-radius:50%;display:inline-block;animation:spin .6s linear infinite}`,
    `@keyframes spin{to{transform:rotate(360deg)}}`
  ]
})
export class ContactPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly contactService = inject(ContactService);
  private readonly isProduction = environment.production;

  readonly sending = signal(false);
  readonly notice = signal('');
  readonly error = signal('');
  readonly canRetry = signal(false);
  readonly lastContactId = signal('');
  private lastPayload: Omit<ContactFormPayload, 'requestId'> | null = null;

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    phone: ['', Validators.required],
    email: ['', [Validators.email]],
    message: ['', Validators.required]
  });

  async submit(): Promise<void> {
    this.lastPayload = this.form.getRawValue();
    await this.submitInternal(false);
  }

  async retryLastSubmission(): Promise<void> {
    if (!this.lastPayload) return;
    await this.submitInternal(true);
  }

  private async submitInternal(isRetry: boolean): Promise<void> {
    this.notice.set('');
    this.error.set('');
    this.sending.set(true);

    try {
      const requestId = crypto.randomUUID();
      const payload = {
        ...(this.lastPayload ?? this.form.getRawValue()),
        requestId,
        bypassContentDedup: isRetry
      };

      const result = await this.contactService.submit(payload);
      this.lastContactId.set(result.contactId ?? '');

      const anySent = Boolean(result.notifications.email.sent) || Boolean(result.notifications.whatsapp.sent);
      this.canRetry.set(!anySent);

      if (anySent || result.duplicated) {
        this.notice.set('Te responderemos en breve.');
      } else {
        this.error.set(this.isProduction
          ? 'Inténtalo de nuevo en unos segundos.'
          : `Email: ${result.notifications.email.warning ?? 'sin detalle'} · WhatsApp: ${result.notifications.whatsapp.warning ?? 'sin detalle'}`);
      }

      if (!isRetry) this.form.reset();
    } catch (error) {
      this.canRetry.set(true);
      this.error.set(this.isProduction
        ? 'Inténtalo de nuevo en unos segundos.'
        : (error instanceof Error ? error.message : 'Error inesperado.'));
    } finally {
      this.sending.set(false);
    }
  }
}
