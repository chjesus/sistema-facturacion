import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'sales-orders',
    loadComponent: () => import('./pages/sales-orders/sales-orders.page').then((m) => m.SalesOrdersPage),
  },
  {
    path: 'deliveries',
    loadComponent: () => import('./pages/deliveries/deliveries.page').then((m) => m.DeliveriesPage),
  },
  {
    path: 'invoices',
    loadComponent: () => import('./pages/invoices/invoices.page').then((m) => m.InvoicesPage),
  },
  {
    path: 'payments',
    loadComponent: () => import('./pages/payments/payments.page').then((m) => m.PaymentsPage),
  },
  { path: '', pathMatch: 'full', redirectTo: 'sales-orders' },
  { path: '**', redirectTo: 'sales-orders' },
];
