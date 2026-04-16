import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

interface HeroSlide {
  tagline: string;
  title: string;
  description: string;
  cta: string;
  link: string;
  image: string;
}

@Component({
  selector: 'app-hero-carousel',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './hero-carousel.html',
  styleUrls: ['./hero-carousel.scss'],
})
export class HeroCarouselComponent implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  currentSlide = 0;
  private autoSlideId: ReturnType<typeof setInterval> | null = null;

  slides: HeroSlide[] = [
    {
      tagline: 'EXCLUSIVE OFFER - 30% OFF',
      title: 'Elevate Your Audio Experience',
      description:
        'Pure sound, no noise. The new generation of noise-cancelling wireless headphones is here for professionals like you.',
      cta: 'Shop Collection',
      link: '/search-result',
      image: 'https://images.pexels.com/photos/7679453/pexels-photo-7679453.jpeg',
    },
    {
      tagline: 'SMART TECH 2026',
      title: 'Redefining Modern Watchmaking',
      description:
        'Track your health, manage your day, and look premium with our latest 3D smart watch series. Now with sapphire glass.',
      cta: 'View Details',
      link: '/search-result',
      image: '/assets/images/banner-2.png',
    },
    {
      tagline: 'GAMING ESSENTIALS',
      title: 'Next-Gen Graphics Power',
      description:
        'Unleash the beast with the ultimate gaming hardware. Max settings, 4K resolution, zero lag gaming experience.',
      cta: 'Explore Gear',
      link: '/search-result',
      image: '/assets/images/banner-4.png',
    },
    {
      tagline: 'WORLD CART SPECIALS',
      title: 'Fresh Picks For Smarter Shopping',
      description:
        'Browse standout deals curated for style, value and everyday essentials in one smooth shopping journey.',
      cta: 'Browse Offers',
      link: '/search-result',
      image: '/assets/images/banner-5.png',
    },
  ];

  ngOnInit(): void {
    this.startAutoSlide();
  }

  ngOnDestroy(): void {
    this.clearAutoSlide();
  }

  nextSlide(): void {
    this.currentSlide = (this.currentSlide + 1) % this.slides.length;
    this.cdr.detectChanges();
    this.restartAutoSlide();
  }

  prevSlide(): void {
    this.currentSlide =
      (this.currentSlide - 1 + this.slides.length) % this.slides.length;
    this.cdr.detectChanges();
    this.restartAutoSlide();
  }

  goToSlide(index: number): void {
    this.currentSlide = index;
    this.cdr.detectChanges();
    this.restartAutoSlide();
  }

  private startAutoSlide(): void {
    this.autoSlideId = setInterval(() => {
      this.currentSlide = (this.currentSlide + 1) % this.slides.length;
      this.cdr.detectChanges();
    }, 4000);
  }

  private restartAutoSlide(): void {
    this.clearAutoSlide();
    this.startAutoSlide();
  }

  private clearAutoSlide(): void {
    if (this.autoSlideId) {
      clearInterval(this.autoSlideId);
      this.autoSlideId = null;
    }
  }
}
