import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-auth-layout',
    standalone: true,
    imports: [CommonModule, RouterModule],
    template: `
    <div class="auth-layout">
      <router-outlet></router-outlet>
    </div>
  `,
    styles: [`
    .auth-layout {
      min-height: 100vh;
      background: linear-gradient(135deg, #f85606 0%, #ff8b52 100%);
      display: flex;
      align-items: center;
      justify-content: center;
    }
  `]
})
export class AuthLayoutComponent { }

