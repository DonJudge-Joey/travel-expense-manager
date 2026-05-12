import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const EXCHANGE_RATES = { USD: 1, JPY: 156.66, CNY: 6.82 };

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userName = searchParams.get('userName');
    const date = searchParams.get('date');

    if (!userName) {
      return NextResponse.json({ error: 'userName is required' }, { status: 400 });
    }

    if (!date) {
      return NextResponse.json({ error: 'date is required' }, { status: 400 });
    }

    // Get budget from Supabase
    const budgetRes = await fetch(
      `${SUPABASE_URL}/rest/v1/budgets?user_name=eq.${userName}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    const budgets = await budgetRes.json();
    const budget = Array.isArray(budgets) && budgets.length > 0 ? budgets[0] : null;

    if (!budget) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    }

    const totalBudgetUsd = parseFloat(budget.total_budget_usd);

    // Get expenses from Supabase
    const expensesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/expenses?user_name=eq.${userName}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    const userExpenses = await expensesRes.json();

    // Calculate total spent
    const totalSpentUsd = Array.isArray(userExpenses)
      ? userExpenses.reduce((sum: number, exp: { amount_usd: string }) => sum + parseFloat(exp.amount_usd || '0'), 0)
      : 0;

    // Calculate daily spent
    const dailySpentUsd = Array.isArray(userExpenses)
      ? userExpenses
          .filter((exp: { expense_date: string }) => exp.expense_date === date)
          .reduce((sum: number, exp: { amount_usd: string }) => sum + parseFloat(exp.amount_usd || '0'), 0)
      : 0;

    // Calculate remaining
    const totalRemaining = Math.max(0, totalBudgetUsd - totalSpentUsd);
    
    // Calculate daily budget
    const startDate = new Date(budget.start_date);
    const endDate = new Date(budget.end_date);
    const tripDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const dailyBudgetUsd = tripDays > 0 ? totalBudgetUsd / tripDays : 0;
    const dailyRemaining = Math.max(0, dailyBudgetUsd - dailySpentUsd);

    return NextResponse.json({
      totalRemaining,
      totalRemainingJpy: totalRemaining * EXCHANGE_RATES.JPY,
      dailyRemaining,
      dailyRemainingJpy: dailyRemaining * EXCHANGE_RATES.JPY,
      totalBudget: totalBudgetUsd,
      totalSpent: totalSpentUsd,
      dailySpent: dailySpentUsd,
    });
  } catch (err) {
    console.error('Remaining budget error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
