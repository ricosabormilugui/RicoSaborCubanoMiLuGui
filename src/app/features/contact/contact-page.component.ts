import { getUserFriendlyError } from '../../core/utils/user-friendly-error';
import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ContactFormPayload, ContactService } from '../../core/services/contact.service';
import { NotificationService } from '../../core/services/notification.service';
import { buildWhatsAppContactUrl } from '../../core/config/whatsapp.config';
import { IconComponent } from '../../shared/ui/icon.component';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, IconComponent],
  template: `
    <section class="contact-shell">
      <article class="card contact-card">
        <header class="head">
          <p class="eyebrow">Soporte inmediato</p>
          <h1>Solicitar información</h1>
          <p class="sub">Déjanos tus datos y te responderemos por email.</p>
        </header>

        <form [formGroup]="form" (ngSubmit)="submit()" class="contact-form">
          <input class="input" formControlName="name" aria-label="Nombre" placeholder="Nombre" />
          <input class="input" formControlName="phone" type="tel" aria-label="Teléfono" placeholder="Teléfono" />
          <input class="input" formControlName="email" type="email" aria-label="Email" placeholder="Email" />
          <textarea class="input" formControlName="message" aria-label="Mensaje" placeholder="¿Cómo te ayudamos?"></textarea>

          <label class="legal-check">
            <input type="checkbox" formControlName="legalConsent" />
            <span>He leído y acepto la <a routerLink="/legal/privacidad">política de privacidad</a> para que gestionéis mi solicitud. También puedes contactarnos manualmente por WhatsApp si lo prefieres.</span>
          </label>
          <small class="field-error" *ngIf="form.controls.legalConsent.invalid && form.controls.legalConsent.touched">Debes aceptar la política de privacidad.</small>

          <button class="btn btn-primary" type="submit" [disabled]="form.invalid || sending()">
            <span *ngIf="!sending()">Enviar solicitud</span>
            <span *ngIf="sending()" class="spinner" aria-label="Enviando"></span>
          </button>
        </form>



        <p class="meta" *ngIf="lastContactId()">ID de solicitud: {{ lastContactId() }}</p>
        <div class="secondary-actions">
          <a class="btn btn-secondary whatsapp-btn" *ngIf="whatsappContactUrl()" [href]="whatsappContactUrl()" target="_blank" rel="noopener noreferrer">
            <app-icon name="whatsapp" [size]="16" />
            Contactar por WhatsApp
          </a>
        <button class="btn btn-secondary whatsapp-btn" *ngIf="canRetry()" (click)="retryLastSubmission()" [disabled]="sending()">Reintentar</button></div>
        
      </article>
    </section>
  `,
  styles: [
    `.contact-shell{display:grid;place-items:center;padding:1rem 0}`,
    `.contact-card{width:min(760px,100%);background:linear-gradient(180deg,var(--surface-0) 0%,var(--surface-1) 100%);border:1px solid var(--border-soft);color:var(--text-main)}`,
    `.head{margin-bottom:.8rem}`,
    `.eyebrow{margin:0;color:var(--accent-green);font-weight:700;font-size:.8rem;letter-spacing:.3px;text-transform:uppercase}`,
    `.head h1{margin:.2rem 0 .35rem}`,
    `.sub{margin:0;color:var(--text-soft)}`,
    `.contact-form{display:grid;gap:.72rem}`,
    `.input{border:1px solid var(--border-soft);border-radius:12px;padding:12px;width:100%;transition:all .2s;background:var(--surface-1);color:var(--text-main)}`,
    `.input:focus{border-color:var(--accent-red);box-shadow:0 0 0 3px color-mix(in srgb, var(--accent-red) 30%, transparent);outline:none}`,
    `.input::placeholder{color:var(--text-soft)}`,
    `.legal-check{display:flex;align-items:flex-start;gap:.55rem;color:var(--text-soft);font-weight:800}`,
    `.legal-check input{margin-top:.2rem;width:18px;height:18px}`,
    `.legal-check a{color:var(--accent-green);font-weight:900}`,
    `.field-error{color:var(--error-text);font-weight:800}`,
    `textarea.input{min-height:120px;resize:vertical}`,
    `.app-alert{display:grid;gap:.22rem;white-space:pre-line}`,
    `.meta{color:var(--text-soft);font-size:.88rem;margin-top:.35rem}`,
    `.spinner{width:18px;height:18px;border:2px solid var(--on-accent);border-top-color:transparent;border-radius:50%;display:inline-block;animation:spin .6s linear infinite}`,
    `.secondary-actions{display:flex;flex-wrap:wrap;gap:.65rem;margin-top:.75rem;min-width:0}.whatsapp-btn{width:100%;max-width:100%;box-sizing:border-box;min-width:0}`,`@keyframes spin{to{transform:rotate(360deg)}}`,`@media (min-width:640px){.whatsapp-btn{width:auto}}`
  ]
})
export class ContactPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly contactService = inject(ContactService);
  private readonly notifications = inject(NotificationService);

  readonly sending = signal(false);
  readonly canRetry = signal(false);
  readonly lastContactId = signal('');
  readonly whatsappContactUrl = signal<string | null>(buildWhatsAppContactUrl());
  private lastPayload: Omit<ContactFormPayload, 'requestId'> | null = null;

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    phone: ['', Validators.required],
    email: ['', [Validators.email]],
    message: ['', Validators.required],
    legalConsent: [false, [Validators.requiredTrue]]
  });

  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const { legalConsent: _legalConsent, ...payload } = this.form.getRawValue();
    this.lastPayload = payload;
    await this.submitInternal(false);
  }

  async retryLastSubmission(): Promise<void> {
    if (!this.lastPayload) return;
    await this.submitInternal(true);
  }

  private async submitInternal(isRetry: boolean): Promise<void> {
    if (this.sending()) return;
    const id = this.notifications.loading('Enviando solicitud…', undefined, { key: 'contact-submit' });
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

      const anySent = Boolean(result.notifications.email.sent);
      this.canRetry.set(!anySent);

      if (anySent || result.duplicated) {
        this.notifications.updateSuccess(id, 'Solicitud enviada', 'Te responderemos en breve.');
      } else {
        this.notifications.warning('Solicitud guardada sin aviso por email', 'Puedes volver a intentar el envío.', { id, action: { label: 'Reintentar', handler: () => this.retryLastSubmission() } });
      }

      if (!isRetry) this.form.reset();
    } catch (error) {
      this.canRetry.set(true);
      this.notifications.updateError(id, 'No se pudo enviar la solicitud', getUserFriendlyError(error), { action: { label: 'Reintentar', handler: () => this.retryLastSubmission() } });
    } finally {
      this.sending.set(false);
    }
  }
}
