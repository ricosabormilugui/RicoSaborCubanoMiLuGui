import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ContactService } from '../../core/services/contact.service';

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
      <p class="err" *ngIf="error()">{{ error() }}</p>
    </section>
  `,
  styles: [
    `form{display:grid;gap:.7rem}`,
    `input,textarea{padding:.6rem;border:1px solid #cfd8e3;border-radius:8px}`,
    `.ok{color:#0f7a3b;white-space:pre-line}`,
    `.err{color:#b42318;white-space:pre-line}`
  ]
})
export class ContactPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly contactService = inject(ContactService);

  readonly sending = signal(false);
  readonly notice = signal('');
  readonly error = signal('');

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    phone: ['', Validators.required],
    email: ['', [Validators.email]],
    message: ['', Validators.required]
  });

  async submit(): Promise<void> {
    this.notice.set('');
    this.error.set('');
    this.sending.set(true);

    try {
      const requestId = crypto.randomUUID();
      const result = await this.contactService.submit({
        ...this.form.getRawValue(),
        requestId
      });

      const emailLine = result.notifications.email.sent
        ? '📧 Email enviado'
        : `❗ Email no enviado: ${result.notifications.email.warning ?? 'sin detalle'}`;
      const whatsappLine = result.notifications.whatsapp.sent
        ? '📱 WhatsApp enviado'
        : `❗ WhatsApp no enviado: ${result.notifications.whatsapp.warning ?? 'sin detalle'}`;

      if (result.duplicated) {
        this.notice.set(`ℹ️ Solicitud ya registrada (evitamos duplicado)\n${emailLine}\n${whatsappLine}`);
      } else if (result.ok) {
        const fullSent = result.notifications.email.sent && result.notifications.whatsapp.sent;
        this.notice.set(fullSent
          ? `✅ Solicitud enviada\n${emailLine}\n${whatsappLine}`
          : `⚠️ Solicitud registrada\n${emailLine}\n${whatsappLine}`);
      } else {
        this.error.set(`❌ No se pudo completar el envío por canales\n${emailLine}\n${whatsappLine}`);
      }

      this.form.reset();
    } catch (error) {
      this.error.set(`❌ No se pudo enviar la solicitud\n${error instanceof Error ? error.message : 'Error inesperado.'}`);
    } finally {
      this.sending.set(false);
    }
  }
}
