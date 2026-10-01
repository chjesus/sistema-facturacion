import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly navigation = [
    { label: 'Sales Orders', path: '/sales-orders' },
    { label: 'Deliveries', path: '/deliveries' },
    { label: 'Invoices', path: '/invoices' },
    { label: 'Payments', path: '/payments' },
  ];
}
