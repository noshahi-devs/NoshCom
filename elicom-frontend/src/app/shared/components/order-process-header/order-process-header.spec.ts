import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrderProcessHeader } from './order-process-header';

describe('OrderProcessHeader', () => {
  let component: OrderProcessHeader;
  let fixture: ComponentFixture<OrderProcessHeader>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderProcessHeader]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrderProcessHeader);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
