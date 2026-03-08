import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './core/components/toast.component';
import { GlobalButtonLoadingService } from './core/services/global-button-loading.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastComponent],
  templateUrl: './app.html'
})
export class AppComponent {
  title = 'Prime Ship';

  constructor(private readonly globalButtonLoadingService: GlobalButtonLoadingService) {
    this.globalButtonLoadingService.init();
  }
}
