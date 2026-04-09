import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      <div *ngFor="let toast of (toasts$ | async) || []" 
       class="toast" 
       [ngClass]="'toast-' + toast.type">
        <div class="toast-icon">
          <i class="fas" [ngClass]="{
            'fa-check-circle': toast.type === 'success',
            'fa-exclamation-circle': toast.type === 'error',
            'fa-info-circle': toast.type === 'info',
            'fa-exclamation-triangle': toast.type === 'warning'
          }"></i>
        </div>
        <div class="toast-content">
          <div class="toast-title">{{ getToastTitle(toast.type) }}</div>
          <div class="toast-message">{{ toast.message }}</div>
        </div>
        <button class="toast-close" (click)="remove(toast.id)">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .toast-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 400px;
    }

    .toast {
      --toast-accent-rgb: 248, 86, 6;
      --toast-bg: #ffffff;
      --toast-text: #111827;
      --toast-body: rgba(17, 24, 39, 0.78);
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 14px 14px 12px;
      border-radius: 14px;
      box-shadow: 0 10px 22px rgba(15, 23, 42, 0.12);
      background: var(--toast-bg);
      border: 1px solid rgba(var(--toast-accent-rgb), 0.16);
      animation: slideIn 0.3s ease-out;
      position: relative;
      overflow: hidden;
    }

    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    .toast-icon {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: rgba(var(--toast-accent-rgb), 0.12);
      color: rgba(var(--toast-accent-rgb), 0.95);
      font-size: 18px;
      flex-shrink: 0;
    }

    .toast-message {
      font-size: 14px;
      line-height: 1.5;
      color: var(--toast-body);
      font-weight: 550;
      word-break: break-word;
      overflow-wrap: anywhere;
    }

    .toast-content {
      flex: 1;
      min-width: 0;
      display: grid;
      gap: 2px;
    }

    .toast-title {
      font-size: 13px;
      font-weight: 900;
      letter-spacing: -0.01em;
      color: rgba(var(--toast-accent-rgb), 0.95);
      line-height: 1.2;
    }

    .toast-close {
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      color: rgba(17, 24, 39, 0.45);
      width: 34px;
      height: 34px;
      padding: 0;
      border-radius: 10px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
    }

    .toast-close:hover {
      background: rgba(var(--toast-accent-rgb), 0.12);
      color: rgba(var(--toast-accent-rgb), 0.95);
      transform: rotate(6deg);
    }

    .toast::before {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at 18% 22%, rgba(var(--toast-accent-rgb), 0.06), transparent 58%);
      pointer-events: none;
    }

    .toast-success {
      --toast-accent-rgb: var(--primary-rgb, 16, 185, 129);
      --toast-bg: #ECFDF5;
      --toast-text: #065F46;
      --toast-body: rgba(17, 24, 39, 0.78);
      border-left: 4px solid var(--primary, #10B981);
      box-shadow: 0 12px 26px rgba(var(--toast-accent-rgb), 0.14);
    }

    .toast-success .toast-icon {
      color: rgba(var(--toast-accent-rgb), 0.95);
    }

    .toast-error {
      --toast-accent-rgb: var(--primary-rgb, 16, 185, 129);
      --toast-bg: #ECFDF5;
      --toast-text: #065F46;
      --toast-body: rgba(17, 24, 39, 0.78);
      border-left: 4px solid var(--primary, #10B981);
      border-color: rgba(16, 185, 129, 0.22);
      box-shadow: 0 12px 26px rgba(var(--toast-accent-rgb), 0.14);
    }

    .toast-error .toast-icon {
      color: rgba(var(--toast-accent-rgb), 0.95);
    }

    .toast-error::before { }

    .toast-info {
      --toast-accent-rgb: var(--primary-rgb, 16, 185, 129);
      --toast-bg: #F0FDFA;
      --toast-text: #065F46;
      --toast-body: rgba(17, 24, 39, 0.78);
      border-left: 4px solid var(--primary, #10B981);
      box-shadow: 0 12px 26px rgba(var(--toast-accent-rgb), 0.14);
    }

    .toast-info .toast-icon {
      color: rgba(var(--toast-accent-rgb), 0.95);
    }

    .toast-warning {
      --toast-accent-rgb: 245, 158, 11;
      --toast-bg: #FFFBEB;
      --toast-text: #78350F;
      --toast-body: rgba(17, 24, 39, 0.78);
      border-left: 4px solid #f59e0b;
      box-shadow: 0 12px 26px rgba(var(--toast-accent-rgb), 0.14);
    }

    .toast-warning .toast-icon {
      color: rgba(var(--toast-accent-rgb), 0.95);
    }

    @media (max-width: 768px) {
      .toast-container {
        top: auto;
        bottom: 14px;
        right: 14px;
        left: 14px;
        max-width: none;
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
}
