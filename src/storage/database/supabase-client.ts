// 直接使用Supabase REST API的fetch客户端
// 由于PostgREST schema cache问题，我们使用这个简化的客户端

const supabaseUrl = 'https://bbmdviffgxarxuptfftp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJibWR2aWZmZ3hhcnh1cHRmZnRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MzgyNzEsImV4cCI6MjA4NTUxNDI3MX0.qqceYnTa7ZtD-Sl1JbNFs1l_0JStdTzrrIXiXv62k54';

export async function supabaseFetch<T>(
  endpoint: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
    params?: Record<string, string>;
  } = {}
): Promise<{ data: T | null; error: { message: string; code: string } | null }> {
  const { method = 'GET', body, params } = options;
  
  let url = `${supabaseUrl}/rest/v1/${endpoint}`;
  const searchParams = new URLSearchParams(params || {});
  // 添加时间戳绕过PostgREST缓存
  searchParams.set('_t', Date.now().toString());
  url += `?${searchParams.toString()}`;

  const headers: Record<string, string> = {
    'apikey': supabaseAnonKey,
    'Authorization': `Bearer ${supabaseAnonKey}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Prefer': 'return=representation',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
  };

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
    
    if (!response.ok) {
      return { data: null, error: { message: (data as { message?: string })?.message || 'Request failed', code: String(response.status) } };
    }

    return { data: data as T, error: null };
  } catch (error) {
    return { data: null, error: { message: (error as Error).message, code: 'FETCH_ERROR' } };
  }
}

// Budget 类型
export interface Budget {
  id: number;
  user_name: string;
  total_budget_usd: number;
  start_date: string;
  end_date: string;
}

// Expense 类型
export interface Expense {
  id: number;
  user_name: string;
  expense_date: string;
  currency: string;
  amount: string;
  amount_usd: string;
  category: string;
  description: string | null;
  created_at: string;
}

export { supabaseUrl, supabaseAnonKey };

// 获取所有预算
export async function getBudgets(userName?: string) {
  const params = userName ? { user_name: `eq.${userName}` } : undefined;
  return supabaseFetch<Budget[]>('budgets', { params });
}

// 获取指定用户的消费记录
export async function getExpenses(userName?: string) {
  const params = userName ? { user_name: `eq.${userName}` } : undefined;
  return supabaseFetch<Expense[]>('expenses', { params });
}

// 创建消费记录
export async function createExpense(expense: Omit<Expense, 'id' | 'created_at'>) {
  return supabaseFetch<Expense[]>('expenses', {
    method: 'POST',
    body: expense,
  });
}
