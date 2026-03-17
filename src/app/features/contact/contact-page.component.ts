import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ContactFormPayload, ContactService } from '../../core/services/contact.service';
import { environment } from '../../../environments/environment';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="card">
      <h1>Solicitar información</h1>
      <form [formGroup]="form" (ngSubmit)="submit()">
        <input formControlName="name" placeholder="Nombre" />
        <input formControlName="phone" placeholder="Teléfono" />
        <input formControlName="email" placeholder="Email" />
        <textarea formControlName="message" placeholder="¿Cómo te ayudamos?"></textarea>
        <button class="btn btn-primary" type="submit" [disabled]="form.invalid || sending()">
          {{ sending() ? 'Enviando...' : 'Enviar solicitud' }}
        </button>
      </form>

      <p class="ok" *ngIf="notice()">{{ notice() }}</p>
      <p class="meta" *ngIf="lastContactId()">ID de solicitud: {{ lastContactId() }}</p>
      <button class="btn" *ngIf="canRetry()" (click)="retryLastSubmission()" [disabled]="sending()">Reintentar</button>
      <p class="err" *ngIf="error()">{{ error() }}</p>
    </section>
  `,
  styles: [
    `form{display:grid;gap:.7rem}`,
    `input,textarea{padding:.6rem;border:1px solid #cfd8e3;border-radius:8px}`,
    `.ok{color:#0f7a3b;white-space:pre-line}`,
    `.err{color:#b42318;white-space:pre-line}`,
    `.meta{color:#475467;font-size:.9rem}`
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

      const emailOk = Boolean(result.notifications.email.sent);
      const whatsappOk = Boolean(result.notifications.whatsapp.sent);
      const anySent = emailOk || whatsappOk;
      this.canRetry.set(!anySent);

      if (anySent || result.duplicated) {
        this.notice.set('✅ Solicitud enviada correctamente\nTe responderemos en breve.');
      } else {
        this.error.set(this.isProduction
          ? '❌ No hemos podido enviar tu solicitud\nInténtalo de nuevo.'
          : `❌ No se pudo completar el envío por canales\nEmail: ${result.notifications.email.warning ?? 'sin detalle'}\nWhatsApp: ${result.notifications.whatsapp.warning ?? 'sin detalle'}`);
      }

      if (!isRetry) {
        this.form.reset();
      }
    } catch (error) {
      this.canRetry.set(true);
      this.error.set(this.isProduction
        ? '❌ No hemos podido enviar tu solicitud\nInténtalo de nuevo.'
        : `❌ No se pudo enviar la solicitud\n${error instanceof Error ? error.message : 'Error inesperado.'}`);
    } finally {
      this.sending.set(false);
    }
  }
}
