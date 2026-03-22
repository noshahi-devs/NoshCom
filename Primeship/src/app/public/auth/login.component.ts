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
  isLoading = false;
  showPassword = false;
  returnUrl: string = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private toastService: ToastService
  ) {
    console.log('🏗️ LoginComponent constructor called');
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      rememberMe: [false]
    });
  }

  ngOnInit(): void {
    console.log('🔄 ngOnInit called');

    // Capture return URL (if any). Role-based destination is decided after login.
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '';
    console.log('📍 Return URL set to:', this.returnUrl);

    // If already logged in, redirect to return URL
    const isAuth = this.authService.isAuthenticated();
    console.log('🔐 Is authenticated?', isAuth);

    if (isAuth) {
      const destination = this.resolvePostLoginUrl(this.returnUrl);
      console.log('??? Already authenticated, redirecting to:', destination);
      this.router.navigate([destination], { replaceUrl: true });
    }
  }

  onSubmit(): void {
    console.log('📝 Form submitted');
    console.log('📋 Form valid?', this.loginForm.valid);
    console.log('📋 Form values:', this.loginForm.value);

    if (this.loginForm.valid) {
      this.isLoading = true;
      console.log('⏳ Loading started');

      const loginData = {
        userNameOrEmailAddress: this.loginForm.value.email,
        password: this.loginForm.value.password,
        rememberClient: this.loginForm.value.rememberMe
      };

      console.log('🚀 Calling authService.login with:', {
        email: loginData.userNameOrEmailAddress,
        rememberMe: loginData.rememberClient
      });

      this.authService.login(loginData).subscribe({
        next: (response) => {
          console.log('✅ Login API response received:', response);

          this.isLoading = false;
          console.log('⏳ Loading stopped');

          this.toastService.showSuccess('Login successful! Welcome to Prime Ship.');
          console.log('🎉 Success toast shown');

          // Store email for future use
          localStorage.setItem('userEmail', this.loginForm.value.email);
          console.log('💾 User email stored in localStorage');

          // Determine destination based on roles
          const destination = this.resolvePostLoginUrl(this.returnUrl);

          console.log('🧭 Attempting navigation to:', destination);

          this.router.navigate([destination], { replaceUrl: true }).then(
            (success) => {
              console.log('✅ Navigation completed. Success:', success);
              console.log('📍 Current URL after navigation:', this.router.url);
            },
            (error) => {
              console.error('❌ Navigation failed with error:', error);
              window.location.href = destination;
            }
          );
        },
        error: (error) => {
          console.error('❌ Login API error:', error);

          this.isLoading = false;
          console.log('⏳ Loading stopped (error)');

          // Extract error message from API response
          let errorMessage = 'Login failed. Please try again.';

          if (error.error?.error?.message) {
            errorMessage = error.error.error.message;
          } else if (error.message) {
            errorMessage = error.message;
          }

          console.log('📝 Error message:', errorMessage);

          // Check for specific error types
          if (errorMessage.includes('email is not confirmed') ||
            errorMessage.includes('not verified')) {
            this.toastService.showError(
              'Your email is not verified. Please check your inbox for the verification link.'
            );
          } else if (errorMessage.toLowerCase().includes('inactive')) {
            this.toastService.showError(
              'Your account is pending admin approval. Please contact support or wait for activation.'
            );
          } else if (errorMessage.includes('Invalid password')) {
            this.toastService.showError('Invalid password. Please try again.');
          } else if (errorMessage.includes('Invalid email') ||
            errorMessage.includes('Invalid username')) {
            this.toastService.showError(
              'Account not found. Please check your email or register a new account.'
            );
          } else {
            this.toastService.showError(errorMessage);
          }

          console.error('🚨 Full error object:', error);
        }
      });
    } else {
      console.log('❌ Form is invalid');
      console.log('📋 Form errors:', this.loginForm.errors);

      // Mark all fields as touched to show validation errors
      Object.keys(this.loginForm.controls).forEach(key => {
        const control = this.loginForm.get(key);
        control?.markAsTouched();
        console.log(`📝 Field "${key}" errors:`, control?.errors);
      });
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  private resolvePostLoginUrl(returnUrl: string): string {
    // Always send Admin/Seller to their dashboards
    if (this.authService.isAdmin()) {
      return '/admin/dashboard';
    }

    if (this.authService.isSeller()) {
      return '/seller/dashboard';
    }

    // For other roles (buyer), respect returnUrl if it's safe
    if (returnUrl && returnUrl !== '/auth/login' && !returnUrl.startsWith('/auth/login')) {
      return returnUrl;
    }

    return '/home';
  }
}

