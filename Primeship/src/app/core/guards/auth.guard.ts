import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    private router: Router,
    private authService: AuthService
  ) { }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    const url = state.url;

    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/auth/login'], {
        queryParams: { returnUrl: state.url }
      });
      return false;
    }

    // Role-based authorization
    if (url.startsWith('/admin')) {
      if (this.authService.isAdmin()) {
        return true;
      }
      // If not admin, try to redirect to seller dashboard if they are a seller
      if (this.authService.isSeller()) {
        this.router.navigate(['/seller/dashboard']);
        return false;
      }
      this.router.navigate(['/home']);
      return false;
    }

    if (url.startsWith('/seller')) {
      // Merchant Portal should open seller dashboard for any authenticated user.
      // Seller/Admin keep full role behavior; others can still access seller entry pages.
      return true;
    }

    return true;
  }
}
