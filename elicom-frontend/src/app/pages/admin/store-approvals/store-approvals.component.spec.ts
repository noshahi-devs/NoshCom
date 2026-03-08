import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StoreApprovalsComponent } from './store-approvals.component';
import { StoreService } from '../../../services/store.service';
import { of } from 'rxjs';
import { ChangeDetectorRef } from '@angular/core';

describe('StoreApprovalsComponent', () => {
    let component: StoreApprovalsComponent;
    let fixture: ComponentFixture<StoreApprovalsComponent>;
    let mockStoreService: any;

    beforeEach(async () => {
        mockStoreService = {
            getAllStores: () => of({
                success: true,
                result: {
                    items: [
                        { id: '1', name: 'Store 1', status: false },
                        { id: '2', name: 'Store 2', status: true }
                    ]
                }
            }),
            approveStore: (id: string) => of({ success: true }),
            rejectStore: (id: string) => of({ success: true })
        };

        await TestBed.configureTestingModule({
            imports: [StoreApprovalsComponent],
            providers: [
                { provide: StoreService, useValue: mockStoreService }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(StoreApprovalsComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should load stores on init', () => {
        expect(component.applications.length).toBe(2);
        expect(component.applications[0].name).toBe('Store 1');
    });

    it('should calculate stats correctly', () => {
        component.calculateStats();
        expect(component.pendingStores).toBe(1); // Only Store 1 is false
    });

    it('should handle alternative API response structure', () => {
        mockStoreService.getAllStores = () => of({
            items: [
                { id: '3', name: 'Store 3', status: false }
            ]
        });

        component.loadApplications();
        expect(component.applications.length).toBe(1);
        expect(component.applications[0].name).toBe('Store 3');
    });
});
