import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-register',
  standalone: false,
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent implements OnInit {
  registerForm: FormGroup;
  isLoading = false;
  showPassword = false;
  showConfirmPassword = false;

  // States for animation
  showCelebration = false;
  isProcessing = false;
  isSuccess = false;
  confettiPieces = Array(100).fill(0);

  countries = [
    'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany',
    'France', 'Spain', 'Italy', 'Netherlands', 'Belgium', 'Switzerland',
    'Austria', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Ireland',
    'Portugal', 'Greece', 'Poland', 'Czech Republic', 'Hungary',
    'Romania', 'Bulgaria', 'Croatia', 'Slovenia', 'Slovakia',
    'Lithuania', 'Latvia', 'Estonia', 'India', 'Pakistan',
    'Bangladesh', 'China', 'Japan', 'South Korea', 'Singapore',
    'Malaysia', 'Thailand', 'Indonesia', 'Philippines', 'Vietnam',
    'UAE', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman',
    'Egypt', 'South Africa', 'Nigeria', 'Kenya', 'Brazil', 'Mexico',
    'Argentina', 'Chile', 'Colombia', 'Peru', 'New Zealand'
  ];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) {
    this.registerForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.required],
      country: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
      agreeTerms: [false, Validators.requiredTrue]
    }, { validator: this.passwordMatchValidator });
  }

  ngOnInit(): void {
  }

  passwordMatchValidator(form: FormGroup): any {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  }

  onSubmit(): void {
    if (this.registerForm.valid) {
      // Start processing UI
      this.isProcessing = true;
      this.isSuccess = false;
      this.showCelebration = true;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      this.cdr.detectChanges();

      const registerData = {
        fullName: this.registerForm.value.name,
        emailAddress: this.registerForm.value.email,
        password: this.registerForm.value.password,
        phoneNumber: this.registerForm.value.phone,
        country: this.registerForm.value.country,
        isActive: true,
        isEmailConfirmed: true
      };

      this.authService.registerSeller(registerData).subscribe({
        next: (response) => {
          this.isProcessing = false;
          this.isSuccess = true;
          this.cdr.detectChanges();

          this.toastService.showSuccess(
            'Registration successful! Your account is active and verified.'
          );

          this.registerForm.reset();
        },
        error: (error) => {
          this.isProcessing = false;
          this.isSuccess = false;
          this.showCelebration = false;
          this.cdr.detectChanges();

          let errorMessage = 'Registration failed. Please try again.';
          if (error.error?.error?.message) {
            errorMessage = error.error.error.message;
          } else if (error.message) {
            errorMessage = error.message;
          }
          this.toastService.showError(errorMessage);
          console.error('Registration error:', error);
        }
      });
    } else {
      Object.keys(this.registerForm.controls).forEach(key => {
        this.registerForm.get(key)?.markAsTouched();
      });
      this.toastService.showWarning('Please fill in all required fields correctly.');
    }
  }

  closeModal(): void {
    this.showCelebration = false;
    this.router.navigate(['/auth/login']);
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }
}
