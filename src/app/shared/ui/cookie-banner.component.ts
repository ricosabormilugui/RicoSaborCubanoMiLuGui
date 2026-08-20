import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CookieConsentService } from '../../core/services/cookie-consent.service';

@Component({
  selector: 'app-cookie-banner',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="cookie-banner" *ngIf="!cookies.hasDecision()" role="dialog" aria-live="polite" aria-label="Configuración de cookies">
      <div class="cookie-card">
        <div>
          <p class="eyebrow">Privacidad</p>
          <h2>Configura tus cookies</h2>
          <p>Usamos cookies necesarias para que la web funcione. Las analíticas y marketing solo se activarán si nos das permiso.</p>
          <a routerLink="/legal/cookies">Ver política de cookies</a>
        </div>

        <div class="cookie-settings" *ngIf="configuring()">
          <label class="locked"><input type="checkbox" checked disabled /> Necesarias <small>Siempre activas</small></label>
          <label><input type="checkbox" [checked]="analytics()" (change)="analytics.set($any($event.target).checked)" /> Analíticas</label>
          <label><input type="checkbox" [checked]="marketing()" (change)="marketing.set($any($event.target).checked)" /> Marketing</label>
        </div>

        <div class="cookie-actions">
          <button class="btn" type="button" (click)="cookies.rejectOptional()">Rechazar</button>
          <button class="btn" type="button" (click)="configuring.set(!configuring())">Configurar</button>
          <button class="btn btn-primary" type="button" *ngIf="!configuring()" (click)="cookies.acceptAll()">Aceptar todas</button>
          <button class="btn btn-primary" type="button" *ngIf="configuring()" (click)="saveCustom()">Guardar selección</button>
        </div>
      </div>
    </section>
  `,
  styles: [
    `.cookie-banner{position:fixed;inset:auto 0 0;z-index:200;padding:1rem;background:linear-gradient(180deg,transparent,var(--overlay-bg))}`,
    `.cookie-card{width:min(980px,100%);margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:1rem;align-items:center;border:1px solid var(--border-soft);border-radius:18px;padding:1rem;background:var(--surface-0);box-shadow:var(--shadow-card);color:var(--text-main)}`,
    `.eyebrow{margin:0;color:var(--accent-green);font-weight:900;text-transform:uppercase;font-size:.78rem;letter-spacing:.05em}`,
    `h2{margin:.15rem 0 .35rem}`,
    `p{margin:0 0 .4rem;color:var(--text-soft);line-height:1.45}`,
    `a{color:var(--accent-green);font-weight:800}`,
    `.cookie-settings{display:grid;gap:.45rem;border:1px solid var(--border-soft);border-radius:12px;padding:.7rem;background:var(--surface-1)}`,
    `.cookie-settings label{display:flex;align-items:center;gap:.5rem;font-weight:800}`,
    `.cookie-settings small{color:var(--text-soft);font-weight:700}`,
    `.locked{opacity:.8}`,
    `.cookie-actions{display:flex;gap:.5rem;flex-wrap:wrap;justify-content:flex-end}`,
    `.cookie-actions .btn{white-space:nowrap}`,
    `@media (max-width:760px){.cookie-card{grid-template-columns:1fr}.cookie-actions{justify-content:stretch}.cookie-actions .btn{flex:1 1 140px}}`
  ]
})
export class CookieBannerComponent {
  readonly cookies = inject(CookieConsentService);
  readonly configuring = signal(false);
  readonly analytics = signal(false);
  readonly marketing = signal(false);

  saveCustom(): void {
    this.cookies.save({ analytics: this.analytics(), marketing: this.marketing() });
  }
}
