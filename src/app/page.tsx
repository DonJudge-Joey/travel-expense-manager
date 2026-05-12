'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Calendar, Edit2, Trash2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { format, differenceInDays, parseISO, isValid } from 'date-fns';

type Currency = 'USD' | 'JPY' | 'CNY';
type ExpenseType = '餐饮' | '交通' | '其他';

interface User {
  name: string;
  startDate: string;
  endDate: string;
}

interface Budget {
  id: string;
  user_name: string;
  total_budget_usd: number;
  start_date: string;
  end_date: string;
}

interface Expense {
  id: string;
  user_name: string;
  expense_date: string;
  currency: Currency;
  amount: number;
  expense_type: ExpenseType;
  description?: string;
  amount_usd?: number;
}

interface ExchangeRates {
  JPY: number;
  CNY: number;
}

interface UserBudgetInfo {
  budget: Budget | null;
  totalSpent: number;
  totalRemaining: number;
  dailyBudget: number;
  dailyRemaining: number;
  todayRemaining: number;
  previousDayBalance: number;
  expenses: Expense[];
}

const allUsers: User[] = [
	  { name: 'Joey', startDate: '2026-05-10', endDate: '2026-05-23' },
	  { name: 'Mia', startDate: '2026-05-10', endDate: '2026-05-16' },
	  { name: 'Eddie', startDate: '2026-05-11', endDate: '2026-05-23' },
];

const expenseTypes = [
  { value: '餐饮', label: '餐饮' },
  { value: '交通', label: '交通' },
  { value: '其他', label: '其他' },
];

const expenseTypeColors: Record<ExpenseType, string> = {
  '餐饮': 'bg-orange-100 text-orange-700',
  '交通': 'bg-blue-100 text-blue-700',
  '其他': 'bg-gray-100 text-gray-700',
};

const formatCurrency = (amount: number | string, currency: Currency = 'USD'): string => {
  const numAmount = typeof amount === 'number' ? amount : parseFloat(String(amount)) || 0;
  if (currency === 'JPY') {
    return `${Math.round(numAmount).toLocaleString()} JPY`;
  }
  if (currency === 'CNY') {
    return `${numAmount.toFixed(2)} CNY`;
  }
  return `$${numAmount.toFixed(2)}`;
};

const formatDate = (dateStr: string): string => {
  try {
    const date = parseISO(dateStr);
    if (!isValid(date)) return dateStr;
    return format(date, 'MM/dd');
  } catch {
    return dateStr;
  }
};

const formatDateFull = (dateStr: string): string => {
  try {
    const date = parseISO(dateStr);
    if (!isValid(date)) return dateStr;
    return format(date, 'yyyy年MM月dd日');
  } catch {
    return dateStr;
  }
};

const getTripDays = (startDate: string, endDate: string): number => {
  try {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    if (!isValid(start) || !isValid(end)) return 0;
    return differenceInDays(end, start) + 1;
  } catch {
    return 0;
  }
};

export default function TravelExpenseManager() {
  const [selectedUser, setSelectedUser] = useState<string>('Joey');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [userInfo, setUserInfo] = useState<Record<string, UserBudgetInfo>>({});
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [converterFrom, setConverterFrom] = useState<Currency>('USD');
  const [converterAmount, setConverterAmount] = useState('');

  const [newExpense, setNewExpense] = useState<{
    date: string;
    currency: Currency;
    amount: string;
    expenseType: ExpenseType;
    description: string;
  }>({
    date: (() => {
      const d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    })(),
    currency: 'JPY',
    amount: '',
    expenseType: '餐饮',
    description: '',
  });

  const [editingExpense, setEditingExpense] = useState<{
    id: string;
    date: string;
    currency: Currency;
    amount: string;
    expenseType: ExpenseType;
    description: string;
  } | null>(null);

  const [isAddingExpense, setIsAddingExpense] = useState(false);

  const loadExchangeRates = useCallback(async () => {
    try {
      const response = await fetch('/api/exchange-rates');
      const data = await response.json();
      setExchangeRates(data);
    } catch (error) {
      console.error('Failed to load exchange rates:', error);
      setExchangeRates({ JPY: 150, CNY: 7.2 });
    }
  }, []);

  // 货币换算函数
  const convertCurrency = (amount: number, from: Currency, to: Currency): number => {
    if (from === to) return amount;
    const jpyRate = exchangeRates?.JPY || 150;
    const cnyRate = exchangeRates?.CNY || 7.2;
    if (from === 'USD') {
      return to === 'JPY' ? amount * jpyRate : amount * cnyRate;
    }
    if (from === 'JPY') {
      return to === 'USD' ? amount / jpyRate : (amount / jpyRate) * cnyRate;
    }
    if (from === 'CNY') {
      return to === 'USD' ? amount / cnyRate : (amount / cnyRate) * jpyRate;
    }
    return amount;
  };

  const loadUserData = useCallback(async () => {
    setIsLoading(true);
    try {
      const infoMap: Record<string, UserBudgetInfo> = {};

      for (const user of allUsers) {
        const budgetResponse = await fetch(`/api/budgets?userName=${user.name}`);
        const budgetList = await budgetResponse.json();
        const budget = Array.isArray(budgetList) && budgetList.length > 0 ? budgetList[0] : null;

        const expensesResponse = await fetch(`/api/expenses?userName=${user.name}`);
        const expenses = await expensesResponse.json();

        const totalSpent = Array.isArray(expenses) 
          ? expenses.reduce((sum: number, exp: Expense) => sum + Number(exp.amount_usd || 0), 0)
          : 0;
        
        const budgetUsd = budget ? Number(budget.total_budget_usd || 0) : 0;
        const totalRemaining = budget && budgetUsd > 0 ? budgetUsd - totalSpent : 0;

        const tripDays = getTripDays(user.startDate, user.endDate);
        const dailyBudget = budget && tripDays > 0 && budgetUsd > 0 ? budgetUsd / tripDays : 0;

        const forceYear = '2026';
        const selectedDate2026 = selectedDateRef.current.replace(/^\d{4}/, forceYear);
        const selectedDateSpent = Array.isArray(expenses)
          ? expenses
              .filter((exp: Expense) => {
                const expDate2026 = (exp.expense_date || '').replace(/^\d{4}/, forceYear);
                return expDate2026 === selectedDate2026;
              })
              .reduce((sum: number, exp: Expense) => sum + Number(exp.amount_usd || 0), 0)
          : 0;

        const todayRemaining = dailyBudget - selectedDateSpent;

        const startDateStr = user.startDate.replace(/^\d{4}/, forceYear);
        const startDateObj = new Date(startDateStr);
        const selectedDateObj2 = new Date(selectedDateRef.current.replace(/^\d{4}/, forceYear));

        let previousDayBalance = 0;
        const currentDate = new Date(startDateObj);
        while (currentDate < selectedDateObj2) {
          const dateStr = currentDate.toISOString().split('T')[0];
          const daySpent = Array.isArray(expenses)
            ? expenses
                .filter((exp: Expense) => {
                  const expDate2026 = (exp.expense_date || '').replace(/^\d{4}/, forceYear);
                  return expDate2026 === dateStr;
                })
                .reduce((sum: number, exp: Expense) => sum + Number(exp.amount_usd || 0), 0)
            : 0;
          previousDayBalance += dailyBudget - daySpent;
          currentDate.setDate(currentDate.getDate() + 1);
        }

        const dailyRemaining = todayRemaining + previousDayBalance;

        infoMap[user.name] = {
          budget: budget,
          totalSpent,
          totalRemaining,
          dailyBudget,
          dailyRemaining,
          todayRemaining,
          previousDayBalance,
          expenses: expenses || [],
        };
      }

      setUserInfo(infoMap);
    } catch (error) {
      console.error('Failed to load user data:', error);
      toast.error('加载数据失败，请刷新重试');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExchangeRates();
    loadUserData();
  }, [loadExchangeRates, loadUserData, refreshKey]);


  // 使用ref跟踪上一次的用户，只有用户真正切换时才重置日期
  const prevUserRef = useRef<string | null>(null);
  // 使用ref跟踪最新的selectedDate，避免依赖数组变化问题
  const selectedDateRef = useRef<string>('');
  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);
  
  // 初始化日期和切换用户时重置日期为当天
  useEffect(() => {
    if (!userInfo[selectedUser]?.budget) return;
    
    const today = new Date();
    const year = 2026;
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const localDate = year + '-' + month + '-' + day;
    const forceYear = '2026';
    const startDate = userInfo[selectedUser].budget.start_date?.replace(/^\d{4}/, forceYear);
    const endDate = userInfo[selectedUser].budget.end_date?.replace(/^\d{4}/, forceYear);
    
    // 如果日期超出范围或用户切换，则重置
    if (localDate < startDate || localDate > endDate) {
      setSelectedDate(startDate || localDate);
    } else if (prevUserRef.current !== selectedUser) {
      setSelectedDate(localDate);
    }
    prevUserRef.current = selectedUser;
  }, [selectedUser, userInfo]);

  useEffect(() => {
    if (selectedDate) {
      loadUserData();
    }
  }, [selectedDate, loadUserData]);

  const handleAddExpense = async () => {
    if (!newExpense.amount || parseFloat(newExpense.amount) <= 0) {
      toast.error('请输入有效金额');
      return;
    }

    setIsAddingExpense(true);
    try {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName: selectedUser,
          expenseDate: newExpense.date,
          currency: newExpense.currency,
          amount: parseFloat(newExpense.amount),
          expenseType: newExpense.expenseType,
          description: newExpense.description,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add expense');
      }

      toast.success('消费记录已添加');
      setNewExpense({
        date: (() => {
          const d = new Date();
          return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        })(),
        currency: 'JPY',
        amount: '',
        expenseType: '餐饮',
        description: '',
      });
      setRefreshKey(k => k + 1);
      loadUserData();
    } catch (error) {
      console.error('Failed to add expense:', error);
      toast.error('添加消费记录失败');
    } finally {
      setIsAddingExpense(false);
    }
  };

  const handleEditExpense = async () => {
    if (!editingExpense || !editingExpense.id || !editingExpense.amount || parseFloat(editingExpense.amount) <= 0) {
      toast.error('请输入有效金额');
      return;
    }

    setIsAddingExpense(true);
    try {
      const response = await fetch(`/api/expenses?id=${editingExpense.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expenseDate: editingExpense.date,
          currency: editingExpense.currency,
          amount: parseFloat(editingExpense.amount),
          expenseType: editingExpense.expenseType,
          description: editingExpense.description,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update expense');
      }

      toast.success('消费记录已更新');
      setEditingExpense(null);
      setRefreshKey(k => k + 1);
      loadUserData();
    } catch (error) {
      console.error('Failed to update expense:', error);
      toast.error('更新消费记录失败');
    } finally {
      setIsAddingExpense(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      const response = await fetch(`/api/expenses?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete expense');
      }

      toast.success('消费记录已删除');
      setRefreshKey(k => k + 1);
      loadUserData();
    } catch (error) {
      console.error('Failed to delete expense:', error);
      toast.error('删除消费记录失败');
    }
  };

  const info = userInfo[selectedUser];
  const budgetUsagePercent = info && info.budget ? (info.totalSpent / Number(info.budget.total_budget_usd)) * 100 : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster />
      <main className="container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">差旅费用管理</h1>
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 mb-4">
          <span>实时汇率: 1 USD = {exchangeRates?.JPY?.toFixed(2) || '-'} JPY | 1 USD = {exchangeRates?.CNY?.toFixed(2) || '-'} CNY</span>
        </div>
        
        {/* 货币换算器 */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <h3 className="text-sm font-medium text-slate-700 mb-3">货币换算</h3>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <select
                value={converterFrom}
                onChange={(e) => setConverterFrom(e.target.value as Currency)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="USD">USD</option>
                <option value="JPY">JPY</option>
                <option value="CNY">CNY</option>
              </select>
              <input
                type="number"
                value={converterAmount}
                onChange={(e) => setConverterAmount(e.target.value)}
                placeholder="输入金额"
                className="w-28 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <span className="text-slate-400">=</span>
            <div className="flex flex-wrap gap-2">
              {(['USD', 'JPY', 'CNY'] as Currency[]).filter(c => c !== converterFrom).map((currency) => (
                <div key={currency} className="px-3 py-2 bg-slate-100 rounded-lg text-sm">
                  <span className="text-slate-500">{currency}: </span>
                  <span className="font-medium text-slate-800">
                    {formatCurrency(convertCurrency(Number(converterAmount) || 0, converterFrom, currency), currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Tabs value={selectedUser} onValueChange={setSelectedUser} className="w-full mt-6">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            {allUsers.map((user) => {
              const userData = userInfo[user.name];
              const isOverBudget = userData && userData.totalRemaining < 0;
              return (
                <TabsTrigger
                  key={user.name}
                  value={user.name}
                  className="relative data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                >
                  <span>{user.name}</span>
                  {isOverBudget && (
                    <AlertCircle className="w-4 h-4 ml-1 text-red-500" />
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {allUsers.map((user) => {
            const userInfoData = userInfo[user.name];
            return (
              <TabsContent key={user.name} value={user.name} className="space-y-6">
                {isLoading ? (
                  <Card>
                    <CardContent className="py-12 text-center text-slate-500">
                      加载中...
                    </CardContent>
                  </Card>
                ) : !userInfoData?.budget ? (
                  <Card>
                    <CardContent className="py-12 text-center text-slate-500">
                      未找到预算信息
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <Card className="p-4">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <Calendar className="w-5 h-5 text-slate-500" />
                        <div className="flex-1">
                          <label className="text-xs font-medium text-slate-500 mb-1 block">选择日期</label>
                          <input
                            type="date"
                            value={selectedDate}
                            min={userInfoData.budget.start_date ? userInfoData.budget.start_date.replace(/^\d{4}/, '2026') : undefined}
                            max={userInfoData.budget.end_date ? userInfoData.budget.end_date.replace(/^\d{4}/, '2026') : undefined}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full max-w-[150px] h-8 px-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                      </div>
                    </Card>

                    <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
                      <Card className="p-3 sm:p-4">
                        <div className="text-xs font-medium text-slate-500 mb-1">总预算</div>
                        <div className="text-xl sm:text-2xl font-bold">
                          ${Number(userInfoData.budget?.total_budget_usd || 0).toFixed(2)}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {formatDateFull(userInfoData.budget.start_date.replace(/^\d{4}/, '2026'))} - {formatDateFull(userInfoData.budget.end_date.replace(/^\d{4}/, '2026'))}
                        </p>
                      </Card>

                      <Card className="p-3 sm:p-4">
                        <div className="text-xs font-medium text-slate-500 mb-1">每日预算</div>
                        <div className="text-xl sm:text-2xl font-bold">
                          ${userInfoData.dailyBudget.toFixed(2)}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {getTripDays(userInfoData.budget.start_date, userInfoData.budget.end_date)} 天
                        </p>
                      </Card>

                      <Card className={`p-3 sm:p-4 ${userInfoData.totalRemaining < 0 ? 'border-red-300 bg-red-50' : ''}`}>
                        <div className="text-xs font-medium text-slate-500 mb-1">总剩余</div>
                        <div className={`text-xl sm:text-2xl font-bold ${userInfoData.totalRemaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          ${userInfoData.totalRemaining.toFixed(2)}
                        </div>
                        {exchangeRates && (
                          <p className="text-xs text-slate-500 mt-1">
                            ≈ {formatCurrency(userInfoData.totalRemaining * exchangeRates.CNY, 'CNY')} · {formatCurrency(userInfoData.totalRemaining * exchangeRates.JPY, 'JPY')}
                          </p>
                        )}
                      </Card>

                      <Card className={`p-3 sm:p-4 ${userInfoData.dailyRemaining < 0 ? 'border-red-300 bg-red-50' : ''}`}>
                        <div className="text-xs font-medium text-slate-500 mb-1">今日可用</div>
                        <div className={`text-xl sm:text-2xl font-bold ${userInfoData.dailyRemaining < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                          ${userInfoData.dailyRemaining.toFixed(2)}
                        </div>
                        {exchangeRates && (
                          <p className="text-xs text-slate-500 mt-1">
                            ≈ {formatCurrency(userInfoData.dailyRemaining * exchangeRates.CNY, 'CNY')} · {formatCurrency(userInfoData.dailyRemaining * exchangeRates.JPY, 'JPY')}
                          </p>
                        )}
                        <div className="mt-2 pt-2 border-t border-slate-200 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">今日剩余</span>
                            <span className={`text-sm font-medium ${userInfoData.todayRemaining < 0 ? 'text-red-600' : 'text-slate-700'}`}>
                              ${userInfoData.todayRemaining.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">前日结余</span>
                            <span className={`text-sm font-medium ${userInfoData.previousDayBalance < 0 ? 'text-red-600' : userInfoData.previousDayBalance > 0 ? 'text-green-600' : 'text-slate-500'}`}>
                              {userInfoData.previousDayBalance >= 0 ? '+' : ''}${userInfoData.previousDayBalance.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">预算使用进度</CardTitle>
                        <CardDescription>
                          已使用 ${userInfoData.totalSpent.toFixed(2)} / ${Number(userInfoData.budget?.total_budget_usd || 0).toFixed(2)}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div>
                          <div className="relative h-5 mb-1">
                            <span 
                              className={`absolute text-xs font-medium ${budgetUsagePercent > 100 ? 'text-red-600' : 'text-slate-600'}`}
                              style={{ left: `${Math.min(100, budgetUsagePercent)}%`, transform: 'translateX(-50%)' }}
                            >
                              {budgetUsagePercent.toFixed(1)}%
                            </span>
                          </div>
                          <Progress 
                            value={Math.min(100, budgetUsagePercent)} 
                            className={`h-3 ${budgetUsagePercent > 100 ? 'bg-red-200' : ''}`}
                          />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                          <CardTitle className="text-base">消费记录</CardTitle>
                          <CardDescription>
                            共 {userInfoData.expenses.length} 笔消费
                          </CardDescription>
                        </div>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                              添加消费
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-[90vw] sm:max-w-md">
                            <DialogHeader>
                              <DialogTitle>添加消费记录</DialogTitle>
                            </DialogHeader>
                            {userInfoData && exchangeRates && (
                              <Alert className="mb-4 bg-blue-50 border-blue-200 py-2 px-3">
                                <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0" />
                                <AlertDescription className="text-xs sm:text-sm text-blue-800">
                                  {(() => {
                                    const currency = newExpense.currency;
                                    const rate = currency === 'JPY' ? exchangeRates.JPY : currency === 'CNY' ? exchangeRates.CNY : 1;
                                    const symbol = currency === 'USD' ? '$' : currency === 'JPY' ? 'JPY ' : 'CNY ';
                                    const totalInCurrency = userInfoData.totalRemaining * rate;
                                    const dailyInCurrency = userInfoData.dailyRemaining * rate;
                                    const prevInCurrency = userInfoData.previousDayBalance * rate;
                                    return (
                                      <>
                                        <div>总剩余: <strong>{symbol}{totalInCurrency.toFixed(2)}</strong></div>
                                        <div>今日可用: <strong>{symbol}{dailyInCurrency.toFixed(2)}</strong> <span className="text-blue-600">(含前日结余 {prevInCurrency >= 0 ? '+' : ''}{symbol}{prevInCurrency.toFixed(2)})</span></div>
                                      </>
                                    );
                                  })()}
                                </AlertDescription>
                              </Alert>
                            )}
                            <div className="grid gap-3 py-4">
                              <div className="space-y-1.5">
                                <Label>日期</Label>
                                <Input
                                  type="date"
                                  value={newExpense.date}
                                  onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label>币种</Label>
                                <Select value={newExpense.currency} onValueChange={(v) => setNewExpense({ ...newExpense, currency: v as Currency })}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="USD">$ 美元</SelectItem>
                                    <SelectItem value="JPY">JPY 日元</SelectItem>
                                    <SelectItem value="CNY">CNY 人民币</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1.5">
                                <Label>金额</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="输入金额"
                                  value={newExpense.amount}
                                  onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label>类型</Label>
                                <Select value={newExpense.expenseType} onValueChange={(v) => setNewExpense({ ...newExpense, expenseType: v as ExpenseType })}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {expenseTypes.map((type) => (
                                      <SelectItem key={type.value} value={type.value}>
                                        {type.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1.5">
                                <Label>备注</Label>
                                <Input
                                  placeholder="可选"
                                  value={newExpense.description}
                                  onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button onClick={handleAddExpense} disabled={isAddingExpense}>
                                {isAddingExpense ? '添加中...' : '添加'}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </CardHeader>
                      <CardContent className="px-2 sm:px-4">
                        {userInfoData.expenses.length === 0 ? (
                          <div className="text-center py-8 text-slate-500">
                            暂无消费记录
                          </div>
                        ) : (
                          <>
                            <div className="hidden sm:block overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>日期</TableHead>
                                    <TableHead>类型</TableHead>
                                    <TableHead className="text-right">金额</TableHead>
                                    <TableHead className="text-right">折合 USD</TableHead>
                                    <TableHead className="hidden md:table-cell">备注</TableHead>
                                    <TableHead className="w-[100px]"></TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {userInfoData.expenses.map((expense) => (
                                    <TableRow key={expense.id}>
                                      <TableCell className="font-medium">{formatDate(expense.expense_date)}</TableCell>
                                      <TableCell>
                                        <Badge variant="outline" className={`${expenseTypeColors[expense.expense_type as ExpenseType]}`}>
                                          {expense.expense_type}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-right">{formatCurrency(expense.amount, expense.currency as Currency)}</TableCell>
                                      <TableCell className="text-right">${Number(expense.amount_usd || 0).toFixed(2)}</TableCell>
                                      <TableCell className="hidden md:table-cell text-slate-500 text-sm">{expense.description || '-'}</TableCell>
                                      <TableCell>
                                        <div className="flex items-center gap-1">
                                          <Dialog>
                                            <DialogTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-blue-500 hover:text-blue-600 hover:bg-blue-50 h-8 w-8"
                                                onClick={() => setEditingExpense({
                                                  id: expense.id,
                                                  date: expense.expense_date,
                                                  currency: expense.currency as Currency,
                                                  amount: String(expense.amount),
                                                  expenseType: expense.expense_type as ExpenseType,
                                                  description: expense.description || '',
                                                })}
                                              >
                                                <Edit2 className="w-4 h-4" />
                                              </Button>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-[90vw] sm:max-w-md">
                                              <DialogHeader>
                                                <DialogTitle>编辑消费记录</DialogTitle>
                                              </DialogHeader>
                                              {editingExpense && editingExpense.id === expense.id && (
                                                <div className="grid gap-3 py-4">
                                                  <div className="space-y-1.5">
                                                    <Label>日期</Label>
                                                    <Input
                                                      type="date"
                                                      value={editingExpense.date}
                                                      onChange={(e) => setEditingExpense({ ...editingExpense, date: e.target.value })}
                                                    />
                                                  </div>
                                                  <div className="space-y-1.5">
                                                    <Label>币种</Label>
                                                    <Select value={editingExpense.currency} onValueChange={(v) => setEditingExpense({ ...editingExpense, currency: v as Currency })}>
                                                      <SelectTrigger>
                                                        <SelectValue />
                                                      </SelectTrigger>
                                                      <SelectContent>
                                                        <SelectItem value="USD">$ 美元</SelectItem>
                                                        <SelectItem value="JPY">JPY 日元</SelectItem>
                                                        <SelectItem value="CNY">CNY 人民币</SelectItem>
                                                      </SelectContent>
                                                    </Select>
                                                  </div>
                                                  <div className="space-y-1.5">
                                                    <Label>金额</Label>
                                                    <Input
                                                      type="number"
                                                      step="0.01"
                                                      min="0"
                                                      value={editingExpense.amount}
                                                      onChange={(e) => setEditingExpense({ ...editingExpense, amount: e.target.value })}
                                                    />
                                                  </div>
                                                  <div className="space-y-1.5">
                                                    <Label>类型</Label>
                                                    <Select value={editingExpense.expenseType} onValueChange={(v) => setEditingExpense({ ...editingExpense, expenseType: v as ExpenseType })}>
                                                      <SelectTrigger>
                                                        <SelectValue />
                                                      </SelectTrigger>
                                                      <SelectContent>
                                                        {expenseTypes.map((type) => (
                                                          <SelectItem key={type.value} value={type.value}>
                                                            {type.label}
                                                          </SelectItem>
                                                        ))}
                                                      </SelectContent>
                                                    </Select>
                                                  </div>
                                                  <div className="space-y-1.5">
                                                    <Label>备注</Label>
                                                    <Input
                                                      placeholder="可选"
                                                      value={editingExpense.description}
                                                      onChange={(e) => setEditingExpense({ ...editingExpense, description: e.target.value })}
                                                    />
                                                  </div>
                                                </div>
                                              )}
                                              <DialogFooter>
                                                <Button onClick={handleEditExpense} disabled={isAddingExpense}>
                                                  {isAddingExpense ? '保存中...' : '保存修改'}
                                                </Button>
                                              </DialogFooter>
                                            </DialogContent>
                                          </Dialog>
                                          <Dialog>
                                            <DialogTrigger asChild>
                                              <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 w-8">
                                                <Trash2 className="w-4 h-4" />
                                              </Button>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-[90vw] sm:max-w-md">
                                              <DialogHeader>
                                                <DialogTitle>确认删除</DialogTitle>
                                                <DialogDescription>
                                                  确定要删除这笔消费记录吗？此操作无法撤销。
                                                </DialogDescription>
                                              </DialogHeader>
                                              <DialogFooter className="flex-col sm:flex-row gap-2">
                                                <Button
                                                  variant="destructive"
                                                  className="w-full sm:w-auto"
                                                  onClick={() => handleDeleteExpense(expense.id)}
                                                >
                                                  删除
                                                </Button>
                                              </DialogFooter>
                                            </DialogContent>
                                          </Dialog>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>

                            <div className="sm:hidden space-y-3">
                              {userInfoData.expenses.map((expense) => (
                                <div key={expense.id} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm font-medium text-slate-900">
                                          {formatDate(expense.expense_date)}
                                        </span>
                                        <Badge
                                          variant="outline"
                                          className={`text-xs ${expenseTypeColors[expense.expense_type as ExpenseType]}`}
                                        >
                                          {expense.expense_type}
                                        </Badge>
                                      </div>
                                      <div className="text-lg font-bold text-slate-900">
                                        {formatCurrency(expense.amount, expense.currency as Currency)}
                                      </div>
                                      <div className="text-xs text-slate-500 mt-0.5">
                                        ≈ ${Number(expense.amount_usd || 0).toFixed(2)} USD
                                      </div>
                                      {expense.description && (
                                        <div className="text-xs text-slate-600 mt-1 truncate">
                                          {expense.description}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Dialog>
                                        <DialogTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-blue-500 hover:text-blue-600 hover:bg-blue-50 h-8 w-8"
                                            onClick={() => setEditingExpense({
                                              id: expense.id,
                                              date: expense.expense_date,
                                              currency: expense.currency as Currency,
                                              amount: String(expense.amount),
                                              expenseType: expense.expense_type as ExpenseType,
                                              description: expense.description || '',
                                            })}
                                          >
                                            <Edit2 className="w-4 h-4" />
                                          </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-[90vw]">
                                          <DialogHeader>
                                            <DialogTitle>编辑消费记录</DialogTitle>
                                          </DialogHeader>
                                          {editingExpense && editingExpense.id === expense.id && (
                                            <div className="grid gap-3 py-4">
                                              <div className="space-y-1.5">
                                                <Label>日期</Label>
                                                <Input
                                                  type="date"
                                                  value={editingExpense.date}
                                                  onChange={(e) => setEditingExpense({ ...editingExpense, date: e.target.value })}
                                                />
                                              </div>
                                              <div className="space-y-1.5">
                                                <Label>币种</Label>
                                                <Select value={editingExpense.currency} onValueChange={(v) => setEditingExpense({ ...editingExpense, currency: v as Currency })}>
                                                  <SelectTrigger>
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    <SelectItem value="USD">$ 美元</SelectItem>
                                                    <SelectItem value="JPY">JPY 日元</SelectItem>
                                                    <SelectItem value="CNY">CNY 人民币</SelectItem>
                                                  </SelectContent>
                                                </Select>
                                              </div>
                                              <div className="space-y-1.5">
                                                <Label>金额</Label>
                                                <Input
                                                  type="number"
                                                  step="0.01"
                                                  min="0"
                                                  value={editingExpense.amount}
                                                  onChange={(e) => setEditingExpense({ ...editingExpense, amount: e.target.value })}
                                                />
                                              </div>
                                              <div className="space-y-1.5">
                                                <Label>类型</Label>
                                                <Select value={editingExpense.expenseType} onValueChange={(v) => setEditingExpense({ ...editingExpense, expenseType: v as ExpenseType })}>
                                                  <SelectTrigger>
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {expenseTypes.map((type) => (
                                                      <SelectItem key={type.value} value={type.value}>
                                                        {type.label}
                                                      </SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                              </div>
                                              <div className="space-y-1.5">
                                                <Label>备注</Label>
                                                <Input
                                                  placeholder="可选"
                                                  value={editingExpense.description}
                                                  onChange={(e) => setEditingExpense({ ...editingExpense, description: e.target.value })}
                                                />
                                              </div>
                                            </div>
                                          )}
                                          <DialogFooter>
                                            <Button onClick={handleEditExpense} disabled={isAddingExpense}>
                                              {isAddingExpense ? '保存中...' : '保存修改'}
                                            </Button>
                                          </DialogFooter>
                                        </DialogContent>
                                      </Dialog>
                                      <Dialog>
                                        <DialogTrigger asChild>
                                          <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 w-8">
                                            <Trash2 className="w-4 h-4" />
                                          </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-[90vw]">
                                          <DialogHeader>
                                            <DialogTitle>确认删除</DialogTitle>
                                            <DialogDescription>
                                              确定要删除这笔消费记录吗？此操作无法撤销。
                                            </DialogDescription>
                                          </DialogHeader>
                                          <DialogFooter className="flex-col sm:flex-row gap-2">
                                            <Button
                                              variant="destructive"
                                              className="w-full"
                                              onClick={() => handleDeleteExpense(expense.id)}
                                            >
                                              删除
                                            </Button>
                                          </DialogFooter>
                                        </DialogContent>
                                      </Dialog>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </main>
    </div>
  );
}

function Toaster() {
  return null;
}
