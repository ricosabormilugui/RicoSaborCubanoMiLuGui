import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

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
        <button class="btn btn-primary" type="submit" [disabled]="form.invalid">Enviar solicitud</button>
      </form>
      <p *ngIf="sent">Solicitud enviada. Te responderemos pronto.</p>
    </section>
  `,
  styles: [`form{display:grid;gap:.7rem}input,textarea{padding:.6rem;border:1px solid #cfd8e3;border-radius:8px}`]
})
export class ContactPageComponent {
  private readonly fb = inject(FormBuilder);

  sent = false;

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    phone: ['', Validators.required],
    email: ['', [Validators.email]],
    message: ['', Validators.required]
  });

  submit(): void {
    this.sent = true;
    this.form.reset();
  }
}
