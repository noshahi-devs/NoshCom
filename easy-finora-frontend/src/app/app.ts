import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { NgIf, NgClass } from '@angular/common';
import { Header } from './shared/header/header';
import { Sidebar } from './shared/sidebar/sidebar';
import { ToastComponent } from './shared/toast/toast.component';


@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NgIf, NgClass, Header, Sidebar, ToastComponent],
  templateUrl: './app.html',
})
export class App {

  private router = inject(Router);

  mobileMenuOpen = false;

  get showHeaderFooter(): boolean {
    const url = this.router.url;

    return !(
      url.startsWith('/add-to-cart') ||
      url.startsWith('/checkout') ||
      url.startsWith('/auth')
    );
  }

  toggleMobileMenu() {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  closeMobileMenu() {
    this.mobileMenuOpen = false;
  }
}
