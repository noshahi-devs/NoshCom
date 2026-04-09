import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-region" aria-live="polite" aria-atomic="true">
      <div class="toast-stack">
        <div
          *ngFor="let toast of (toasts$ | async) || []; trackBy: trackByToastId"
          class="toast"
          [ngClass]="'toast--' + toast.type"
          [style.--toast-duration-ms]="(toast.duration || 0) + 'ms'"
          role="status"
        >
          <div class="toast__icon" aria-hidden="true">
            <i class="fas" [ngClass]="{
              'fa-check-circle': toast.type === 'success',
              'fa-exclamation-circle': toast.type === 'error',
              'fa-info-circle': toast.type === 'info',
              'fa-exclamation-triangle': toast.type === 'warning'
            }"></i>
          </div>

          <div class="toast__body">
            <div class="toast__title">{{ getToastTitle(toast.type) }}</div>
            <div class="toast__message">{{ toast.message }}</div>
          </div>

          <button type="button" class="toast__close" (click)="remove(toast.id)" aria-label="Dismiss notification">
            <i class="fas fa-times"></i>
          </button>

          <div class="toast__timer" *ngIf="(toast.duration || 0) > 0" aria-hidden="true"></div>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .toast-region {
      position: fixed;
      top: 18px;
      right: 18px;
      z-index: 9999;
      width: min(520px, calc(100vw - 28px));
      pointer-events: none;
    }

    .toast-stack {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .toast {
      --accent-rgb: var(--primary-rgb, 16, 185, 129);
      --surface: #ECFDF5;
      --text: #0f172a;
      --muted: rgba(17, 24, 39, 0.78);

      pointer-events: auto;
      display: grid;
      grid-template-columns: 52px minmax(0, 1fr) 44px;
      gap: 14px;
      align-items: start;
      padding: 18px 18px 18px 16px;
      border-radius: 18px;
      border: 1px solid rgba(var(--accent-rgb), 0.16);
      background: var(--surface);
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
      animation: toastIn 220ms ease-out;
      position: relative;
      overflow: hidden;
    }

    @keyframes toastIn {
      from { transform: translateY(-10px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .toast::before {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at 18% 22%, rgba(var(--accent-rgb), 0.06), transparent 58%);
      pointer-events: none;
    }

    .toast__icon {
      width: 52px;
      height: 52px;
      border-radius: 16px;
      display: grid;
      place-items: center;
      background: rgba(var(--accent-rgb), 0.14);
      color: rgba(var(--accent-rgb), 0.98);
      font-size: 20px;
      position: relative;
      z-index: 1;
    }

    .toast__body {
      min-width: 0;
      display: grid;
      gap: 4px;
      padding-top: 4px;
      position: relative;
      z-index: 1;
    }

    .toast__title {
      font-size: 13px;
      font-weight: 950;
      letter-spacing: -0.01em;
      color: rgba(var(--accent-rgb), 0.98);
      line-height: 1.2;
    }

    .toast__message {
      font-size: 14px;
      line-height: 1.35;
      color: var(--muted);
      font-weight: 650;
      word-break: break-word;
      overflow-wrap: anywhere;
    }

    .toast__close {
      background: none;
      border: none;
      font-size: 16px;
      cursor: pointer;
      color: rgba(15, 23, 42, 0.45);
      width: 44px;
      height: 44px;
      padding: 0;
      border-radius: 14px;
      display: grid;
      place-items: center;
      transition: background 160ms ease, color 160ms ease, transform 160ms ease;
      position: relative;
      z-index: 1;
    }

    .toast__close:hover {
      background: rgba(var(--accent-rgb), 0.12);
      color: rgba(var(--accent-rgb), 0.98);
      transform: rotate(6deg) scale(1.02);
    }

    .toast__timer {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 3px;
      background: rgba(255, 255, 255, 0.65);
      overflow: hidden;
    }

    .toast__timer::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, rgba(var(--accent-rgb), 0.95) 0%, rgba(var(--accent-rgb), 0.65) 100%);
      transform-origin: left;
      animation: toastTimer linear forwards;
      animation-duration: var(--toast-duration-ms);
    }

    @keyframes toastTimer {
      from { transform: scaleX(1); }
      to { transform: scaleX(0); }
    }

    .toast--success {
      --accent-rgb: var(--primary-rgb, 16, 185, 129);
      --surface: #ECFDF5;
    }

    .toast--error {
      --accent-rgb: var(--primary-rgb, 16, 185, 129);
      --surface: #ECFDF5;
    }

    .toast--info {
      --accent-rgb: var(--primary-rgb, 16, 185, 129);
      --surface: #F0FDFA;
    }

    .toast--warning {
      --accent-rgb: 245, 158, 11;
      --surface: #FFFBEB;
    }

    @media (max-width: 768px) {
      .toast-region {
        top: auto;
        bottom: 14px;
        right: 14px;
        left: 14px;
        width: auto;
      }
    }
  `]
})
export class ToastComponent {
  toasts$;

  constructor(public toastService: ToastService) {
    this.toasts$ = this.toastService.toasts$;
  }

  getToastTitle(type: Toast['type']): string {
    switch (type) {
      case 'success':
        return 'Success';
      case 'error':
        return 'Action needed';
      case 'warning':
        return 'Heads up';
      case 'info':
      default:
        return 'Notice';
    }
  }

  remove(id: number): void {
    this.toastService.remove(id);
  }

  trackByToastId(_: number, toast: Toast): number {
    return toast.id;
  }
}
