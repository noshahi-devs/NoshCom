import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SellerDashboardStats {
    activeListings: number;
    totalSales: number;
    totalOrders: number;
    pendingOrders: number;
    shippedOrders: number;
    deliveredOrders: number;
    totalIncome: number;
    totalExpense: number;
    newCustomers: number;
    walletBalance: number;
    payoutTillNow: number;
    recentPayout: number;
    acReserve: number;
    unitsOrdered: number;
    avgUnitsPerOrder: number;
    bulkOrdersCount: number;
    recentOrders: any[];
    weeklyRevenue: number[];
    weeklyOrderCount: number[];

    // New Fields
    zalandoFees: number;
    avgSalePerOrder: number;
    estPayout: number;
    totalRefunds: number;
    netProfit: number;
    netProfitMargin: number;
}

export interface OrderPaymentTransaction {
    orderId: string;
    orderFriendlyId: string;
    saleRevenue: number;
    fee: number;
    netProfit: number;
    profitMargin: number;
    status: string;
    creationTime: string;
}

@Injectable({
    providedIn: 'root'
})
export class SellerDashboardService {
    private http = inject(HttpClient);
    private apiUrl = `${environment.apiUrl}/api/services/app/SellerDashboard`;

    getStats(storeId: string, startDate?: string, endDate?: string): Observable<SellerDashboardStats> {
        let params = new HttpParams().set('storeId', storeId);
        if (startDate) params = params.set('startDate', startDate);
        if (endDate) params = params.set('endDate', endDate);
        return this.http.get<{ result: SellerDashboardStats }>(`${this.apiUrl}/GetStats`, { params })
            .pipe(map(res => res.result));
    }

    getSaleTransactions(storeId: string, startDate?: string, endDate?: string): Observable<OrderPaymentTransaction[]> {
        let params = new HttpParams().set('storeId', storeId);
        if (startDate) params = params.set('startDate', startDate);
        if (endDate) params = params.set('endDate', endDate);
        return this.http.get<{ result: OrderPaymentTransaction[] }>(`${this.apiUrl}/GetSaleTransactions`, { params })
            .pipe(map(res => res.result));
    }
}
