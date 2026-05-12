/**
 * 预算和消费记录数据操作模块
 */

import { getBudgets, getExpenses, createExpense, supabaseFetch } from '@/storage/database/supabase-client';
import { toUSD } from '@/lib/exchange';
import type { Currency, ExpenseType } from '@/lib/exchange';

// 消费记录接口
export interface ExpenseRecord {
	id: number;
	userName: string;
	expenseDate: string;
	currency: Currency;
	amount: number;
	amountUsd: number;
	expenseType: ExpenseType;
	description: string | null;
	createdAt: string;
}

// 预算信息接口
export interface Budget {
	id: number;
	userName: string;
	totalBudgetUsd: number;
	startDate: string;
	endDate: string;
}

// 获取用户预算信息
export async function getBudgetByUser(userName: string): Promise<Budget | null> {
	const result = await getBudgets(userName);
	
	if (result.error) throw new Error(`查询预算失败: ${result.error.message}`);
	
	const data = result.data?.[0];
	if (!data) return null;
	
	return {
		id: data.id as number,
		userName: data.user_name as string,
		totalBudgetUsd: parseFloat(data.total_budget_usd as unknown as string),
		startDate: (data.start_date as string).split('T')[0],
		endDate: (data.end_date as string).split('T')[0],
	};
}

// 获取用户所有消费记录
export async function getExpensesByUser(userName: string): Promise<ExpenseRecord[]> {
	const result = await getExpenses(userName);
	
	if (result.error) throw new Error(`查询消费记录失败: ${result.error.message}`);
	
	return (result.data || []).map((record) => ({
		id: record.id as number,
		userName: record.user_name as string,
		expenseDate: (record.expense_date as string).split('T')[0],
		currency: record.currency as Currency,
		amount: parseFloat(record.amount as unknown as string),
		amountUsd: parseFloat(record.amount_usd as unknown as string),
		expenseType: record.category as ExpenseType,
		description: record.description as string | null,
		createdAt: record.created_at as string,
	}));
}

// 获取用户指定日期的消费记录
export async function getExpensesByUserAndDate(
	userName: string,
	date: string
): Promise<ExpenseRecord[]> {
	const allExpenses = await getExpensesByUser(userName);
	return allExpenses.filter(expense => expense.expenseDate === date);
}

// 获取用户某天的消费总额（美元）
export async function getDailyExpensesUSD(
	userName: string,
	date: string
): Promise<number> {
	const expenses = await getExpensesByUserAndDate(userName, date);
	return expenses.reduce((sum, expense) => sum + expense.amountUsd, 0);
}

// 获取用户总消费额（美元）
export async function getTotalExpensesUSD(userName: string): Promise<number> {
	const expenses = await getExpensesByUser(userName);
	return expenses.reduce((sum, expense) => sum + expense.amountUsd, 0);
}

// 添加消费记录
export async function addExpense(
	userName: string,
	expenseDate: string,
	currency: Currency,
	amount: number,
	expenseType: ExpenseType,
	description?: string
): Promise<ExpenseRecord> {
	// 将金额转换为美元
	const amountUsd = await toUSD(amount, currency);

	const result = await createExpense({
		user_name: userName,
		expense_date: expenseDate,
		currency: currency,
		amount: amount.toString(),
		amount_usd: amountUsd.toString(),
		category: expenseType,
		description: description ?? null,
	});

	if (result.error) throw new Error(`添加消费记录失败: ${result.error.message}`);
	
	const record = result.data as unknown as Record<string, unknown>;
	return {
		id: record.id as number,
		userName: record.user_name as string,
		expenseDate: (record.expense_date as string).split('T')[0],
		currency: record.currency as Currency,
		amount: parseFloat(record.amount as unknown as string),
		amountUsd: parseFloat(record.amount_usd as unknown as string),
		expenseType: record.category as ExpenseType,
		description: record.description as string | null,
		createdAt: record.created_at as string,
	};
}

// 删除消费记录
export async function deleteExpense(id: number): Promise<void> {
	const result = await supabaseFetch('expenses', {
		method: 'DELETE',
		params: { id: `eq.${id}` },
	});
	
	if (result.error) throw new Error(`删除消费记录失败: ${result.error.message}`);
}
