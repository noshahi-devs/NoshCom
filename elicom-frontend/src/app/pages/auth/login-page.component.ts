import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule],
  template: ``
})
export class LoginPageComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);

  ngOnInit(): void {
    if (this.authService.isAuthenticated) {
      this.onAuthenticated();
      return;
    }

    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    this.authService.openAuthModal();
    this.router.navigate(['/'], {
      replaceUrl: true,
      queryParams: returnUrl ? { returnUrl } : undefined
    });
  }

  onClose() {
    this.router.navigate(['/'], { replaceUrl: true });
  }

  onAuthenticated() {
    this.authService.navigateToDashboard();
  }
}
