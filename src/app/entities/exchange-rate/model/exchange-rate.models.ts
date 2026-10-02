import { CurrencyCode } from '../../sales/model/sales.models';

export interface ExchangeRate {
  date: string;
  currency: CurrencyCode;
  rateToUsd: number;
}
