import { Component, HostListener, inject } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd, NavigationStart, NavigationCancel, NavigationError } from '@angular/router';
import { NgClass, NgIf } from '@angular/common';
import { Header } from './shared/header/header';
import { Footer } from './shared/footer/footer';
import { AppPageLoaderService } from './services/app-page-loader.service';


@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NgIf, NgClass, Header, Footer],
  templateUrl: './app.html',
})
export class App {

  private router = inject(Router);
  readonly pageLoader = inject(AppPageLoaderService);
  private currentUrl = window.location.pathname || this.router.url;
  headerHidden = false;
  private lastScrollY = 0;
  private readonly hideThreshold = 32;
  private readonly deltaThreshold = 5;

  constructor() {
    this.pageLoader.startInitialLoad();
    this.router.events
      .subscribe(event => {
        if (event instanceof NavigationStart) {
          this.pageLoader.onNavigationStart();
        }

        if (event instanceof NavigationEnd) {
          this.currentUrl = event.urlAfterRedirects || event.url;
          this.headerHidden = false;
          this.lastScrollY = 0;
          window.scrollTo(0, 0);
          this.pageLoader.onNavigationSettled();
          return;
        }

        if (event instanceof NavigationCancel || event instanceof NavigationError) {
          this.pageLoader.onNavigationSettled();
        }
      });
  }

  get showHeaderFooter(): boolean {
    const url = this.currentUrl || this.router.url;

    return !(
      url.startsWith('/add-to-cart') ||
      url.startsWith('/checkout') ||
      url.startsWith('/customer') ||
      url.startsWith('/seller') ||
      url.startsWith('/admin')
    );
  }

  @HostListener('window:scroll')
  onWindowScroll() {
    if (!this.showHeaderFooter) return;

    const currentScrollY = window.scrollY || document.documentElement.scrollTop || 0;

    if (currentScrollY <= this.hideThreshold) {
      this.headerHidden = false;
      this.lastScrollY = currentScrollY;
      return;
    }

    const scrollingDown = currentScrollY > this.lastScrollY + this.deltaThreshold;
    const scrollingUp = currentScrollY < this.lastScrollY - this.deltaThreshold;

    if (scrollingDown) {
      this.headerHidden = true;
    } else if (scrollingUp) {
      this.headerHidden = false;
    }

    this.lastScrollY = currentScrollY;
  }
}
