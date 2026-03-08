import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class StorageService {
    private apiUrl = `${environment.apiUrl}/services/app/Storage`;

    constructor(private http: HttpClient) { }

    uploadImage(base64Image: string, fileName?: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/UploadImage`, { base64Image, fileName });
    }
}
