import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-corporate-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <iframe [src]="iframeUrl" width="100%" height="100%" class="corporate-iframe" (load)="onIframeLoad()"></iframe>
  `,
  styles: [`
    :host {
      display: block;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
    }
    .corporate-iframe {
      border: none;
      width: 100%;
      height: 100%;
      display: block;
    }
  `]
})
export class CorporatePageComponent implements OnInit, OnDestroy {
  iframeUrl: SafeResourceUrl | null = null;
  validPages = ['about-us', 'our-business', 'our-impact', 'newsroom', 'careers'];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const pageId = params.get('pageId');
      if (pageId && this.validPages.includes(pageId)) {
        this.iframeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(`/assets/corporate/${pageId}.html`);
      } else {
        this.router.navigate(['/']);
      }
    });
  }

  @HostListener('window:message', ['$event'])
  onMessage(event: MessageEvent) {
    if (event.data && event.data.type === 'NAVIGATE_CORPORATE') {
      const path = event.data.path;
      if (this.validPages.includes(path)) {
        this.router.navigate(['/corporate', path]);
      }
    }
  }

  onIframeLoad() {
    window.scrollTo(0, 0);
  }

  ngOnDestroy() {
    // cleanup
  }
}
