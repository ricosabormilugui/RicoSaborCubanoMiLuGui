import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, OnDestroy, afterRenderEffect, inject, viewChild } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss'
})
export class ConfirmDialogComponent implements OnDestroy {
  readonly dialogs = inject(ConfirmDialogService);
  private readonly document = inject(DOCUMENT);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private returnFocus: HTMLElement | null = null;
  private previousOverflow: { body: string; root: string } | null = null;

  constructor() {
    inject(Router).events.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event instanceof NavigationStart) this.finish(false);
    });
    afterRenderEffect(() => {
      const element = this.dialog().nativeElement;
      if (this.dialogs.current() && !element.open) {
        this.returnFocus = this.document.activeElement as HTMLElement | null;
        this.previousOverflow = { body: this.document.body.style.overflow, root: this.document.documentElement.style.overflow };
        this.document.body.style.overflow = 'hidden';
        this.document.documentElement.style.overflow = 'hidden';
        // The browser's modal top layer makes the rest of the document inert.
        element.showModal();
        element.querySelector<HTMLButtonElement>('[data-cancel]')?.focus();
      } else if (!this.dialogs.current()) {
        this.closeElement();
      }
    });
  }

  onCancel(event: Event): void {
    event.preventDefault();
    if (this.dialogs.current()?.closeOnEscape !== false) this.finish(false);
  }

  trapFocus(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.onCancel(event);
      return;
    }
    if (event.key !== 'Tab') return;
    const buttons = this.dialog().nativeElement.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && this.document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && this.document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  finish(confirmed: boolean): void {
    this.closeElement();
    this.dialogs.close(confirmed);
  }

  private closeElement(): void {
    const element = this.dialog().nativeElement;
    if (element.open) element.close();
    if (!this.previousOverflow) return;
    this.document.body.style.overflow = this.previousOverflow.body;
    this.document.documentElement.style.overflow = this.previousOverflow.root;
    this.previousOverflow = null;
    if (this.returnFocus?.isConnected) this.returnFocus.focus({ preventScroll: true });
    this.returnFocus = null;
  }

  ngOnDestroy(): void { this.finish(false); }
}
