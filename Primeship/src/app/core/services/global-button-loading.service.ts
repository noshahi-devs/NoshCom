import { DOCUMENT } from '@angular/common';
import { Injectable, NgZone, Renderer2, RendererFactory2, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { HttpLoadingService } from './http-loading.service';

@Injectable({ providedIn: 'root' })
export class GlobalButtonLoadingService {
  private readonly document = inject(DOCUMENT);
  private readonly renderer: Renderer2 = inject(RendererFactory2).createRenderer(null, null);
  private readonly ngZone = inject(NgZone);
  private readonly loadingService = inject(HttpLoadingService);

  private clickUnlisten?: () => void;
  private submitUnlisten?: () => void;
  private loadingSub?: Subscription;
  private activeButton: HTMLButtonElement | null = null;
  private wasDisabled = false;
  private requestStartedForActive = false;
  private pendingTimer?: ReturnType<typeof setTimeout>;

  init(): void {
    if (this.clickUnlisten) {
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      this.clickUnlisten = this.renderer.listen(this.document, 'click', (event: Event) => {
        this.handleClick(event);
      });
      this.submitUnlisten = this.renderer.listen(this.document, 'submit', (event: Event) => {
        this.handleSubmit(event);
      });
    });

    this.loadingSub = this.loadingService.loading$.subscribe((isLoading) => {
      this.handleLoadingChange(isLoading);
    });
  }

  dispose(): void {
    this.clickUnlisten?.();
    this.submitUnlisten?.();
    this.loadingSub?.unsubscribe();
    this.clearPendingTimer();
    this.releaseActiveButton();
  }

  private handleClick(event: Event): void {
    const clickedElement = event.target as HTMLElement | null;
    if (!clickedElement) {
      return;
    }

    const button = clickedElement.closest('button') as HTMLButtonElement | null;
    if (!button) {
      return;
    }

    this.trackButton(button);
  }

  private handleSubmit(event: Event): void {
    const submitEvent = event as SubmitEvent;
    const submitter = submitEvent.submitter as HTMLButtonElement | null;
    if (!submitter) {
      return;
    }
    this.trackButton(submitter);
  }

  private trackButton(button: HTMLButtonElement): void {
    if (button.disabled || button.classList.contains('skip-global-spinner')) {
      return;
    }

    this.releaseActiveButton();
    this.activeButton = button;
    this.wasDisabled = button.disabled;
    this.requestStartedForActive = false;
    this.applySpinnerVisual(button);

    // If the action does not trigger an HTTP request, do not leave the button stuck.
    this.clearPendingTimer();
    this.pendingTimer = setTimeout(() => {
      if (!this.requestStartedForActive) {
        this.releaseActiveButton();
      }
    }, 1200);
  }

  private handleLoadingChange(isLoading: boolean): void {
    if (!this.activeButton) {
      return;
    }

    if (isLoading) {
      this.requestStartedForActive = true;
      this.applySpinner(this.activeButton);
      return;
    }

    this.releaseActiveButton();
  }

  private applySpinnerVisual(button: HTMLButtonElement): void {
    this.renderer.addClass(button, 'global-btn-loading');
    this.renderer.setAttribute(button, 'aria-busy', 'true');
  }

  private applySpinner(button: HTMLButtonElement): void {
    this.applySpinnerVisual(button);
    this.renderer.setProperty(button, 'disabled', true);
  }

  private releaseActiveButton(): void {
    if (!this.activeButton) {
      return;
    }

    this.renderer.removeClass(this.activeButton, 'global-btn-loading');
    this.renderer.removeAttribute(this.activeButton, 'aria-busy');
    this.renderer.setProperty(this.activeButton, 'disabled', this.wasDisabled);
    this.activeButton = null;
    this.wasDisabled = false;
    this.requestStartedForActive = false;
    this.clearPendingTimer();
  }

  private clearPendingTimer(): void {
    if (!this.pendingTimer) {
      return;
    }
    clearTimeout(this.pendingTimer);
    this.pendingTimer = undefined;
  }
}
