import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="not-found card" aria-labelledby="not-found-title">
      <p class="eyebrow">Error 404</p>
      <h1 id="not-found-title">Página no encontrada</h1>
      <p>La dirección no existe o ya no está disponible.</p>
      <a class="btn btn-primary" routerLink="/productos">Volver al catálogo</a>
    </section>
  `,
  styles: [`
    .not-found{max-width:680px;margin:clamp(2rem,8vw,5rem) auto;padding:clamp(1.25rem,4vw,2.5rem);text-align:center}
    .not-found h1{margin:.25rem 0 .65rem;color:var(--text-main)}
    .not-found p:not(.eyebrow){margin:0 0 1.2rem;color:var(--text-soft)}
    .eyebrow{margin:0;color:var(--accent-red-text);font-weight:900;letter-spacing:.08em;text-transform:uppercase}
  `]
})
export class NotFoundPageComponent {}
