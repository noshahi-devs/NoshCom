import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthModalComponent } from '../../shared/components/auth-modal/auth-modal.component';
import { StoreService } from '../../services/store.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, AuthModalComponent],
  template: `
    <div class="login-page-container">
      <div class="auth-box">
        <app-auth-modal (close)="onClose()" (authenticated)="onAuthenticated()"></app-auth-modal>
      </div>
    </div>
  `,
  styles: [`
    .login-page-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 80vh;
      background: #f8f9fa;
      padding: 20px;
    }
    .auth-box {
      width: 100%;
      max-width: 500px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.05);
      overflow: hidden;
    }
    /* Override modal absolute position if needed, 
       but AuthModalComponent is likely designed as a centered modal. 
       We might need to adjust its CSS or just use it as is if it's a fixed overlay.
    */
  `]
})
export class LoginPageComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private storeService = inject(StoreService);
  private authService = inject(AuthService);

  ngOnInit(): void {
    if (this.authService.isAuthenticated) {
      this.onAuthenticated();
    }
  }

  onClose() {
    // Only navigate to home if they weren't authenticated (just closing the modal/page)
    if (!this.authService.isAuthenticated) {
      this.router.navigate(['/']);
    }
  }

  onAuthenticated() {
    console.log('User authenticated at Login Page');
    this.authService.navigateToDashboard();
  }
}
