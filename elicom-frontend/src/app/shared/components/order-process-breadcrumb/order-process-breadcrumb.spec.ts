import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrderProcessBreadcrumb } from './order-process-breadcrumb';

describe('OrderProcessBreadcrumb', () => {
  let component: OrderProcessBreadcrumb;
  let fixture: ComponentFixture<OrderProcessBreadcrumb>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderProcessBreadcrumb]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrderProcessBreadcrumb);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
