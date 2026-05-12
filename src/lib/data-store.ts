// Shared data storage for travel expense management

// Static budget data matching the database schema
export const BUDGETS_DATA = [
  { id: 1, user_name: 'Joey', total_budget_usd: '700.00', start_date: '2025-05-10', end_date: '2025-05-23' },
  { id: 2, user_name: 'Mia', total_budget_usd: '350.00', start_date: '2025-05-10', end_date: '2025-05-16' },
  { id: 3, user_name: 'Eddie', total_budget_usd: '650.00', start_date: '2025-05-11', end_date: '2025-05-23' },
];

// In-memory storage for expenses
export interface Expense {
  id: number;
  user_name: string;
  expense_date: string;
  currency: string;
  amount: string;
  amount_usd: string;
  category: string;
  description: string;
  created_at: string;
}

export const expenses: Expense[] = [];
let nextExpenseId = 1;

export function getNextExpenseId(): number {
  return nextExpenseId++;
}

// Exchange rates
export const EXCHANGE_RATES = { USD: 1, JPY: 156.66, CNY: 6.82 };

// Helper to convert amount to USD
export function convertToUsd(amount: number, currency: string): number {
  if (currency === 'USD') return amount;
  if (currency === 'JPY') return amount / EXCHANGE_RATES.JPY;
  if (currency === 'CNY') return amount / EXCHANGE_RATES.CNY;
  return amount;
}

// Calculate the number of days between two dates (inclusive)
export function getTripDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
}
