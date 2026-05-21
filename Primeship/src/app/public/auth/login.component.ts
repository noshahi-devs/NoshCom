import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  mfaForm: FormGroup;
  isLoading = false;
  showPassword = false;
  returnUrl: string = '';
  mfaStep = false;
  mfaChallengeId = '';
  mfaDestination = '';
  mfaMessage = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private toastService: ToastService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      rememberMe: [false]
    });

    this.mfaForm = this.fb.group({
      code: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(8)]]
    });
  }

  ngOnInit(): void {
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '';

    if (this.authService.isAuthenticated()) {
      const destination = this.resolvePostLoginUrl(this.returnUrl);
      this.router.navigate([destination], { replaceUrl: true });
    }
  }

  onSubmit(): void {
    if (this.mfaStep) {
      this.submitMfaCode();
      return;
    }

    if (!this.loginForm.valid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const loginData = {
      userNameOrEmailAddress: this.loginForm.value.email,
      password: this.loginForm.value.password,
      rememberClient: this.loginForm.value.rememberMe
    };

    this.authService.login(loginData).subscribe({
      next: (response) => this.handleAuthResponse(response),
      error: (error) => this.handleAuthError(error)
    });
  }

  submitMfaCode(): void {
    if (!this.mfaForm.valid || !this.mfaChallengeId) {
      this.mfaForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const loginData = {
      userNameOrEmailAddress: this.loginForm.value.email,
      password: this.loginForm.value.password,
      rememberClient: this.loginForm.value.rememberMe
    };

    this.authService.verifyMfaLogin(
      loginData,
      this.mfaChallengeId,
      this.mfaForm.value.code.trim()
    ).subscribe({
      next: (response) => this.handleAuthResponse(response),
      error: (error) => this.handleAuthError(error)
    });
  }

  backToCredentials(): void {
    this.mfaStep = false;
    this.mfaChallengeId = '';
    this.mfaDestination = '';
    this.mfaMessage = '';
    this.mfaForm.reset();
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  private handleAuthResponse(response: any): void {
    this.isLoading = false;
    const result = response?.result;

    if (this.authService.isMfaRequired(response)) {
      this.mfaStep = true;
      this.mfaChallengeId = result.mfaChallengeId;
      this.mfaDestination = result.mfaDestinationMasked || 'your email';
      this.mfaMessage = result.mfaMessage || 'Enter the verification code sent to your email.';
      this.toastService.showSuccess(this.mfaMessage);
      return;
    }

    if (!this.authService.storeTokenFromResponse(response)) {
      this.toastService.showError(result?.message || 'Login could not be completed. Please try again.');
      return;
    }

    localStorage.setItem('userEmail', this.loginForm.value.email);
    this.toastService.showSuccess('Login successful! Welcome to Global Mart UK.');

    const destination = this.resolvePostLoginUrl(this.returnUrl);
    this.router.navigate([destination], { replaceUrl: true }).catch(() => {
      window.location.href = destination;
    });
  }

  private handleAuthError(error: any): void {
    this.isLoading = false;

    let errorMessage = error.error?.error?.message || error.message || 'Login failed. Please try again.';

    if (errorMessage.includes('email is not confirmed') || errorMessage.includes('not verified')) {
      errorMessage = 'Your email is not verified. Please check your inbox for the verification link.';
    } else if (errorMessage.toLowerCase().includes('inactive')) {
      errorMessage = 'Your account is pending admin approval. Please contact support.';
    } else if (errorMessage.includes('confirmation code') || errorMessage.includes('MFA')) {
      errorMessage = 'Invalid or expired verification code. Please try again.';
    }

    this.toastService.showError(errorMessage);
  }

  private resolvePostLoginUrl(returnUrl: string): string {
    const loginEmail = (this.loginForm?.value?.email || localStorage.getItem('userEmail') || '').trim();

    if (this.authService.isAdmin() || this.authService.isAdminEmail(loginEmail)) {
      if (returnUrl && returnUrl.startsWith('/admin')) {
        return returnUrl;
      }
      return '/admin/dashboard';
    }

    if (this.authService.isSeller()) {
      return '/seller/dashboard';
    }

    if (returnUrl && returnUrl !== '/auth/login' && !returnUrl.startsWith('/auth/login')) {
      return returnUrl;
    }

    return '/home';
  }
}
