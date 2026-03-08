import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { RatingModule } from 'primeng/rating';
import { CarouselModule } from 'primeng/carousel';
import { FormsModule } from '@angular/forms';
import { ProductCardComponent } from './components/product-card/product-card.component';
import { PriceComponent } from './components/price/price.component';
import { Product3DViewerComponent } from './components/product-3d-viewer/product-3d-viewer.component';

@NgModule({
  declarations: [
    ProductCardComponent,
    PriceComponent
  ],
  imports: [
    CommonModule,
    RouterModule,
    ButtonModule,
    RatingModule,
    CarouselModule,
    FormsModule,
    Product3DViewerComponent
  ],
  exports: [
    CommonModule,
    RouterModule,
    ButtonModule,
    RatingModule,
    CarouselModule,
    FormsModule,
    ProductCardComponent,
    PriceComponent,
    Product3DViewerComponent
  ]
})
export class SharedModule { }
