import { Component, Input, computed, inject } from '@angular/core';
import { ConfirmPaymentComponent } from '../../features/confirm-payment/confirm-payment.component';
import { VoidPaymentComponent } from '../../features/void-payment/void-payment.component';
import { LocalSalesCycleStore } from '../../entities/sales/api/local-sales-cycle-store.service';
import { CurrencyCode, InvoiceId } from '../../entities/sales/model/sales.models';
import { PanelComponent } from '../../shared/ui/panel.component';
import { StatusBadgeComponent, StatusTone } from '../../shared/ui/status-badge.component';

const statusTones: Record<'draft' | 'confirmed' | 'voided', StatusTone> = { draft: 'warning', confirmed: 'success', voided: 'danger' };

@Component({
  selector: 'app-payment-history',
  imports: [ConfirmPaymentComponent, PanelComponent, StatusBadgeComponent, VoidPaymentComponent],
  template: `
    <app-panel label="Payment history"><h2 class="text-xl font-bold tracking-[-.03em] text-ink">Payment history</h2><div class="grid gap-[.85rem]">@for (payment of payments(); track payment.id) { <article class="border-t border-border py-[.9rem]"><div class="flex items-center justify-between gap-3"><strong>{{ payment.reference }}</strong><app-status-badge [label]="payment.status" [tone]="statusTone(payment.status)" /></div><p class="my-[.35rem] text-sm text-muted">{{ money(payment.amount, currency) }} · {{ payment.paymentDate }} · {{ payment.method }}</p><p class="my-[.35rem] text-sm text-muted">Frozen {{ payment.chosenRate }} ({{ payment.rateSource }}, {{ payment.rateDate }}) → {{ money(payment.convertedAmount, currency) }}</p><div class="mt-3 flex flex-wrap gap-2">@if (payment.status === 'draft') { <app-confirm-payment [paymentId]="payment.id" /> } @if (payment.status !== 'voided') { <app-void-payment [paymentId]="payment.id" /> }</div></article> } @empty { <p class="mt-4 leading-relaxed text-muted">No payments recorded for this invoice.</p> }</div></app-panel>
  `,
})
export class PaymentHistoryComponent {
  @Input({ required: true }) invoiceId!: InvoiceId;
  @Input({ required: true }) currency!: CurrencyCode;
  private readonly store = inject(LocalSalesCycleStore);
  protected readonly payments = computed(() => this.store.payments().filter((payment) => payment.invoiceId === this.invoiceId));

  protected statusTone(status: 'draft' | 'confirmed' | 'voided'): StatusTone { return statusTones[status]; }
  protected money(amount: number, currency: CurrencyCode): string { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount); }
}
