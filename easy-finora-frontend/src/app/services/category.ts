import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Category {
  name: string;
  slug: string;
  imageUrl: string;
  status: boolean;
  createdAt: string;
  updatedAt: string;
  id: string;
}

@Injectable({
  providedIn: 'root'
})
export class CategoryService {

  private apiUrl = `${environment.apiUrl}/api/services/app/Category/GetAll`;

  constructor(private http: HttpClient) { }

  getAllCategories(): Observable<Category[]> {
    return this.http.get<any>(this.apiUrl)
      .pipe(
        map(res => res.result?.items || []) // <-- this ensures you get array only
      );
  }

  getCategoryById(id: string): Observable<Category> {
    return this.http.get<any>(`${this.apiUrl}/Get?id=${id}`)
      .pipe(map(res => res.result)); // returns single Category object
  }
}
