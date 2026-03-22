import { Component, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { sheinCriticalStyles } from './our-impact.styles';

@Component({
  selector: 'app-our-impact',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './our-impact.component.html',
  styleUrls: ['./our-impact.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class OurImpactComponent implements OnInit, OnDestroy {
  private styleIds = ['shein-impact-style-1', 'shein-impact-style-2', 'shein-impact-style-3', 'shein-impact-style-4', 'shein-critical-css'];

  constructor(private router: Router) {}

  ngOnInit() {
    this.injectStyles();
    this.attachClickHandlers();
    
    // Add Shein's original body classes so the CSS applies perfectly!
    document.body.classList.add(
      'page-template', 
      'page-template-template-page-largetitle', 
      'page-template-template-page-largetitle-php', 
      'page', 
      'page-id-32', 
      'page-parent', 
      'wp-custom-logo'
    );

    // Attempting to scroll to top on load
    window.scrollTo(0, 0);
  }

  // We dynamically append the original Shein stylesheets to the head
  // so that the exact design applies, but we remove them when leaving!
  private injectStyles() {
    const css1 = document.createElement('link');
    css1.id = this.styleIds[0];
    css1.rel = 'stylesheet';
    css1.href = 'https://www.sheingroup.com/wp-content/uploads/autoptimize/css/autoptimize_single_dd8e3dcfc752e0a73ebe03c3cbb3c213.css?ver=1773681950';
    document.head.appendChild(css1);

    const css2 = document.createElement('link');
    css2.id = this.styleIds[1];
    css2.rel = 'stylesheet';
    css2.href = 'https://www.sheingroup.com/wp-includes/css/dist/block-library/style.min.css?ver=6.6.2';
    document.head.appendChild(css2);

    const css3 = document.createElement('link');
    css3.id = this.styleIds[2];
    css3.rel = 'stylesheet';
    css3.href = 'https://www.sheingroup.com/wp-content/plugins/dearpdf-pro/assets/css/dearpdf.min.css?ver=2.0.71';
    document.head.appendChild(css3);

    const css4 = document.createElement('link');
    css4.id = this.styleIds[3];
    css4.rel = 'stylesheet';
    css4.href = 'https://www.sheingroup.com/wp-content/uploads/autoptimize/css/autoptimize_single_280bb7d354c82e47914e91d3ec1b282e.css?ver=2.4.3';
    document.head.appendChild(css4);

    const inlineStyle = document.createElement('style');
    inlineStyle.id = this.styleIds[4];
    inlineStyle.innerHTML = sheinCriticalStyles;
    document.head.appendChild(inlineStyle);
  }

  // Clean up styles to prevent bleeding into our Angular app!
  ngOnDestroy() {
    this.styleIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
    
    // Remove the body classes
    document.body.classList.remove(
      'page-template', 
      'page-template-template-page-largetitle', 
      'page-template-template-page-largetitle-php', 
      'page', 
      'page-id-32', 
      'page-parent', 
      'wp-custom-logo'
    );
  }

  // Handle routing for all the generic a tags transplanted from raw HTML
  private attachClickHandlers() {
    // Wait for view init
    setTimeout(() => {
      const links = document.querySelectorAll('app-our-impact a');
      links.forEach((link: any) => {
        link.addEventListener('click', (e: Event) => {
          const href = link.getAttribute('data-href');
          if (href) {
            e.preventDefault();
            
            if (href.includes('about-us')) this.router.navigate(['/corporate/about-us']);
            else if (href.includes('our-business')) this.router.navigate(['/corporate/our-business']);
            else if (href.includes('our-impact')) this.router.navigate(['/corporate/our-impact']);
            else if (href.includes('newsroom')) this.router.navigate(['/corporate/newsroom']);
            else if (href.includes('careers')) this.router.navigate(['/corporate/careers']);
          } else {
             const routerLinkAttr = link.getAttribute('routerLink');
             if(!routerLinkAttr) e.preventDefault(); // Block empty links
          }
        });
      });
    }, 100);
  }
}
