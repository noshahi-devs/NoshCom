import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

export interface WholesaleOrderItemInput {
    productId: string;
    quantity: number;
    purchasePrice?: number;
}

export interface CreateWholesaleOrderInput {
    items: WholesaleOrderItemInput[];
    shippingAddress: string;
    customerName: string;
    paymentMethod: string;
    cardNumber?: string;
    expiryDate?: string;
    cvv?: string;
}

@Injectable({
    providedIn: 'root'
})
export class WholesaleService {
    private readonly checkoutPath = '/services/app/Wholesale/PlaceWholesaleOrder';
    private apiRoot = this.normalizeBaseUrl(environment.apiUrl);

    constructor(
        private http: HttpClient,
        private authService: AuthService
    ) { }

    placeWholesaleOrder(input: CreateWholesaleOrderInput): Observable<any> {
        const headers = this.authService.getAuthHeaders();
        const wholesalePayload: CreateWholesaleOrderInput = {
            ...input,
            paymentMethod: (input.paymentMethod || '').trim().toLowerCase(),
            cardNumber: input.cardNumber?.replace(/\s/g, '')
        };

        const endpointCandidates = this.buildCheckoutEndpointCandidates();
        return this.tryPlaceWholesaleOrder(endpointCandidates, wholesalePayload, headers);
    }

    private tryPlaceWholesaleOrder(
        endpoints: string[],
        payload: CreateWholesaleOrderInput,
        headers: HttpHeaders,
        index = 0
    ): Observable<any> {
        const endpoint = endpoints[index];

        // Primary call: this endpoint performs EasyFinora deduction + admin wholesale notification.
        return this.http.post<any>(endpoint, payload, { headers }).pipe(
            map(response => response?.result ?? response),
            catchError((wholesaleErr) => {
                const isEndpointMismatch = wholesaleErr?.status === 404 || wholesaleErr?.status === 405;
                const hasNext = index < endpoints.length - 1;

                if (isEndpointMismatch && hasNext) {
                    return this.tryPlaceWholesaleOrder(endpoints, payload, headers, index + 1);
                }

                // Do not silently fall back to SupplierOrder/Create, otherwise orders can be created
                // without EasyFinora deduction and without expected admin wholesale visibility.
                if (isEndpointMismatch) {
                    return throwError(() => ({
                        ...wholesaleErr,
                        error: {
                            ...(wholesaleErr?.error || {}),
                            error: {
                                ...(wholesaleErr?.error?.error || {}),
                                message: 'Wholesale checkout endpoint unavailable. Payment not processed; order not created.'
                            }
                        }
                    }));
                }
                return throwError(() => wholesaleErr);
            })
        );
    }

    private buildCheckoutEndpointCandidates(): string[] {
        const normalizedRoot = this.apiRoot;
        const rootWithoutApi = normalizedRoot.replace(/\/api$/i, '');
        const rootWithApi = /\/api$/i.test(normalizedRoot) ? normalizedRoot : `${rootWithoutApi}/api`;

        const candidates = [
            `${rootWithApi}${this.checkoutPath}`
        ];

        if (typeof window !== 'undefined') {
            const hostname = (window.location.hostname || '').toLowerCase();
            if (hostname.includes('primeshipuk.com')) {
                candidates.push(`https://api.worldcartus.com/api${this.checkoutPath}`);
            }
            if (hostname === 'localhost' || hostname === '127.0.0.1') {
                candidates.push(`https://localhost:44311/api${this.checkoutPath}`);
            }
        }

        return Array.from(
            new Set(
                candidates
                    .map(url => this.normalizeRepeatedSlashes(url))
                    .filter(url => !!url)
            )
        );
    }

    private normalizeBaseUrl(url: string): string {
        const value = (url || '').trim();
        if (!value) return '';
        return value.replace(/\/+$/, '');
    }

    private normalizeRepeatedSlashes(url: string): string {
        // Keep protocol part untouched while collapsing accidental duplicate slashes in path.
        return url.replace(/([^:]\/)\/+/g, '$1');
    }
}
