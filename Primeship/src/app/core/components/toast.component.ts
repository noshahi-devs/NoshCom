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
        <div class="toast-message">{{ toast.message }}</div>
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
      display: flex;
      align-items: center;
      padding: 16px;
      border-radius: 12px;
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.18);
      background: #ffffff;
      border: 1px solid rgba(var(--toast-accent-rgb), 0.12);
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
      font-size: 24px;
      margin-right: 12px;
      flex-shrink: 0;
    }

    .toast-message {
      flex: 1;
      font-size: 14px;
      line-height: 1.5;
      color: #333;
      word-break: break-word;
      overflow-wrap: anywhere;
    }

    .toast-close {
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      color: #999;
      padding: 0;
      margin-left: 12px;
      flex-shrink: 0;
    }

    .toast-close:hover {
      color: #333;
    }

    .toast::before {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at 20% 20%, rgba(var(--toast-accent-rgb), 0.08), transparent 55%);
      pointer-events: none;
    }

    .toast-success {
      --toast-accent-rgb: var(--primary-rgb, 16, 185, 129);
      border-left: 4px solid var(--primary, #10B981);
      box-shadow: 0 14px 30px rgba(var(--toast-accent-rgb), 0.18);
    }

    .toast-success .toast-icon {
      color: var(--primary, #10B981);
    }

    .toast-error {
      --toast-accent-rgb: 239, 68, 68;
      border-left: 4px solid #ef4444;
      box-shadow: 0 14px 30px rgba(var(--toast-accent-rgb), 0.18);
    }

    .toast-error .toast-icon {
      color: #ef4444;
    }

    .toast-info {
      --toast-accent-rgb: 249, 115, 22;
      border-left: 4px solid #f97316;
      box-shadow: 0 14px 30px rgba(var(--toast-accent-rgb), 0.18);
    }

    .toast-info .toast-icon {
      color: #f97316;
    }

    .toast-warning {
      --toast-accent-rgb: 245, 158, 11;
      border-left: 4px solid #f59e0b;
      box-shadow: 0 14px 30px rgba(var(--toast-accent-rgb), 0.18);
    }

    .toast-warning .toast-icon {
      color: #f59e0b;
    }

    @media (max-width: 768px) {
      .toast-container {
        right: 10px;
        left: 10px;
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

  remove(id: number): void {
    this.toastService.remove(id);
  }
}
