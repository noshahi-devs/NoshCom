import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class SupportService {
  private apiUrl = `${environment.apiUrl}/services/app/SupportTicket`;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }

  createTicket(input: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/Create`, input, {
      headers: this.authService.getAuthHeaders()
    });
  }

  getMyTickets(skipCount: number = 0, maxResultCount: number = 100): Observable<any> {
    return this.http.get(`${this.apiUrl}/GetMyTickets`, {
      headers: this.authService.getAuthHeaders(),
      params: { skipCount: skipCount.toString(), maxResultCount: maxResultCount.toString() }
    });
  }

  getAllTickets(skipCount: number = 0, maxResultCount: number = 100): Observable<any> {
    return this.http.get(`${this.apiUrl}/GetAllTickets`, {
      headers: this.authService.getAuthHeaders(),
      params: { skipCount: skipCount.toString(), maxResultCount: maxResultCount.toString() }
    });
  }

  updateStatus(id: string, status: string, adminRemarks: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/UpdateStatus`, { id, status, adminRemarks }, {
      headers: this.authService.getAuthHeaders()
    });
  }
}
