import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userName = searchParams.get('userName');

    let endpoint = `${SUPABASE_URL}/rest/v1/budgets?select=id,user_name,total_budget_usd,start_date,end_date&order=id.asc`;
    if (userName) {
      endpoint = `${SUPABASE_URL}/rest/v1/budgets?user_name=eq.${userName}&select=id,user_name,total_budget_usd,start_date,end_date`;
    }

    const response = await fetch(endpoint, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      console.error('Supabase error:', await response.text());
      return NextResponse.json([], { status: 200 });
    }

    const data = await response.json();
    
    // 修复日期年份（2025 -> 2026）和确保金额为数字
    const fixedData = Array.isArray(data) ? data.map((item: { 
      id: number; 
      user_name: string; 
      total_budget_usd: string | number;
      start_date: string;
      end_date: string;
    }) => ({
      ...item,
      total_budget_usd: parseFloat(String(item.total_budget_usd)) || 0,
      start_date: String(item.start_date).split('T')[0].replace(/^2025/, '2026'),
      end_date: String(item.end_date).split('T')[0].replace(/^2025/, '2026'),
    })) : [];
    
    return NextResponse.json(fixedData);
  } catch (err) {
    console.error('Budgets API error:', err);
    return NextResponse.json([], { status: 200 });
  }
}
