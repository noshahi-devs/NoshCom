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
      <app-auth-modal [pageMode]="true" (close)="onClose()" (authenticated)="onAuthenticated()"></app-auth-modal>
    </div>
  `,
  styles: [`
    .login-page-container {
      min-height: 100vh;
    }
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
