import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Exchange rates
const EXCHANGE_RATES = { USD: 1, JPY: 156.66, CNY: 6.82 };

function convertToUsd(amount: number, currency: string): number {
  if (currency === 'USD') return amount;
  if (currency === 'JPY') return amount / EXCHANGE_RATES.JPY;
  if (currency === 'CNY') return amount / EXCHANGE_RATES.CNY;
  return amount;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userName = searchParams.get('userName');

    let endpoint = `${SUPABASE_URL}/rest/v1/expenses?select=*,amount::text,expense_date::text&order=expense_date.desc`;
    if (userName) {
      endpoint = `${SUPABASE_URL}/rest/v1/expenses?user_name=eq.${userName}&select=*,amount::text,expense_date::text&order=expense_date.desc`;
    }

    const response = await fetch(endpoint, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
      },
    });

    if (!response.ok) {
      console.error('Supabase expenses error:', await response.text());
      return NextResponse.json([]);
    }

    const data = await response.json();
    const expenses = Array.isArray(data) ? data : [];
    // Map category to expense_type for frontend compatibility, convert amount to number
    return NextResponse.json(expenses.map(e => ({
      ...e,
      expense_type: e.category,
      amount: Number(e.amount) || 0,
      amount_usd: convertToUsd(Number(e.amount) || 0, e.currency)
    })));
  } catch (err) {
    console.error('Expenses API error:', err);
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userName, expenseDate, currency, amount, expenseType, description } = body;

    if (!userName || !expenseDate || !currency || !amount || !expenseType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const numAmount = parseFloat(amount);
    const amountUsd = convertToUsd(numAmount, currency);

    // Insert into Supabase
    const insertResponse = await fetch(`${SUPABASE_URL}/rest/v1/expenses`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        user_name: userName,
        expense_date: expenseDate,
        currency: currency,
        amount: numAmount.toFixed(2),
        amount_usd: amountUsd.toFixed(2),
        category: expenseType,
        description: description || '',
      }),
    });

    if (!insertResponse.ok) {
      console.error('Insert expense error:', await insertResponse.text());
      return NextResponse.json(
        { error: 'Failed to insert expense' },
        { status: 500 }
      );
    }

    const newExpense = await insertResponse.json();
    return NextResponse.json(Array.isArray(newExpense) ? newExpense[0] : newExpense, { status: 201 });
  } catch (err) {
    console.error('Expenses API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const body = await request.json();
    const { expenseDate, currency, amount, expenseType, description } = body;

    if (!expenseDate || !currency || !amount || !expenseType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const numAmount = parseFloat(amount);
    const amountUsd = convertToUsd(numAmount, currency);

    const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/expenses?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        expense_date: expenseDate,
        currency: currency,
        amount: numAmount.toFixed(2),
        amount_usd: amountUsd.toFixed(2),
        category: expenseType,
        description: description || '',
      }),
    });

    if (!updateResponse.ok) {
      console.error('Update expense error:', await updateResponse.text());
      return NextResponse.json(
        { error: 'Failed to update expense' },
        { status: 500 }
      );
    }

    const updated = await updateResponse.json();
    return NextResponse.json(Array.isArray(updated) ? updated[0] : updated);
  } catch (err) {
    console.error('Update expense error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const deleteResponse = await fetch(`${SUPABASE_URL}/rest/v1/expenses?id=eq.${id}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!deleteResponse.ok) {
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete expense error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
