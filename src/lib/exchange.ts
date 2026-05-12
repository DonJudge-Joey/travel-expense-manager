/**
 * 汇率转换工具
 * 支持 USD, JPY, CNY 三种货币的实时汇率查询与转换
 */

// 货币类型
export type Currency = 'USD' | 'JPY' | 'CNY';

// 货币符号映射
export const currencySymbols: Record<Currency, string> = {
	USD: '$',
	JPY: '¥',
	CNY: '¥',
};

// 货币名称映射
export const currencyNames: Record<Currency, string> = {
	USD: '美元',
	JPY: '日元',
	CNY: '人民币',
};

// 费用类型
export const expenseTypes = [
	{ value: '餐饮', label: '餐饮' },
	{ value: '交通', label: '交通' },
	{ value: '其他', label: '其他' },
] as const;

export type ExpenseType = typeof expenseTypes[number]['value'];

// 汇率数据接口
export interface ExchangeRates {
	USD: number; // 1 USD = X CNY
	JPY: number; // 1 JPY = X CNY
	CNY: number; // 基准 = 1
	lastUpdated: string;
}

// 默认汇率（备用）
const defaultRates: ExchangeRates = {
	USD: 7.25, // 1 USD = 7.25 CNY
	JPY: 0.048, // 1 JPY = 0.048 CNY (约 1 CNY = 20.8 JPY)
	CNY: 1,
	lastUpdated: new Date().toISOString(),
};

// 缓存汇率数据
let cachedRates: ExchangeRates | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

/**
 * 获取实时汇率（优先从API获取，失败则使用默认汇率）
 */
export async function getExchangeRates(): Promise<ExchangeRates> {
	const now = Date.now();

	// 返回缓存的汇率
	if (cachedRates && now - lastFetchTime < CACHE_DURATION) {
		return cachedRates;
	}

	try {
		// 使用 exchangerate-api.com 的免费API
		const response = await fetch(
			'https://api.exchangerate-api.com/v4/latest/USD',
			{ next: { revalidate: 300 } } // 5分钟重新验证
		);

		if (!response.ok) {
			throw new Error('Failed to fetch exchange rates');
		}

		const data = await response.json();

		const rates: ExchangeRates = {
			USD: 1,
			JPY: data.rates.JPY,
			CNY: data.rates.CNY,
			lastUpdated: new Date().toISOString(),
		};

		cachedRates = rates;
		lastFetchTime = now;

		return rates;
	} catch (error) {
		console.warn('Failed to fetch exchange rates, using default rates:', error);
		// 使用默认汇率
		cachedRates = {
			...defaultRates,
			lastUpdated: new Date().toISOString(),
		};
		return cachedRates;
	}
}

/**
 * 将任意货币转换为美元
 */
export async function toUSD(amount: number, fromCurrency: Currency): Promise<number> {
	if (fromCurrency === 'USD') {
		return amount;
	}

	const rates = await getExchangeRates();

	if (fromCurrency === 'CNY') {
		return amount / rates.CNY;
	} else if (fromCurrency === 'JPY') {
		// JPY -> CNY -> USD
		const amountInCNY = amount * rates.JPY;
		return amountInCNY / rates.CNY;
	}

	return amount;
}

/**
 * 将美元转换为任意货币
 */
export async function fromUSD(amountUSD: number, toCurrency: Currency): Promise<number> {
	if (toCurrency === 'USD') {
		return amountUSD;
	}

	const rates = await getExchangeRates();

	if (toCurrency === 'CNY') {
		return amountUSD * rates.CNY;
	} else if (toCurrency === 'JPY') {
		// USD -> CNY -> JPY
		const amountInCNY = amountUSD * rates.CNY;
		return amountInCNY / rates.JPY;
	}

	return amountUSD;
}

/**
 * 任意两种货币之间的转换
 */
export async function convertCurrency(
	amount: number,
	fromCurrency: Currency,
	toCurrency: Currency
): Promise<number> {
	if (fromCurrency === toCurrency) {
		return amount;
	}

	const amountInUSD = await toUSD(amount, fromCurrency);
	return fromUSD(amountInUSD, toCurrency);
}

/**
 * 格式化货币显示
 */
export function formatCurrency(amount: number | string, currency: Currency): string {
	const numAmount = Number(amount);

	if (currency === 'JPY') {
		return `${Math.round(numAmount).toLocaleString()} JPY`;
	}

	if (currency === 'CNY') {
		return `${numAmount.toFixed(2)} CNY`;
	}

	// USD 使用 $ 符号
	return `$${numAmount.toFixed(2)}`;
}

/**
 * 获取用户的出差天数
 */
export function getTripDays(startDate: string, endDate: string): number {
	const start = new Date(startDate);
	const end = new Date(endDate);
	const diffTime = Math.abs(end.getTime() - start.getTime());
	const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
	return diffDays;
}

/**
 * 计算每日预算
 */
export function calculateDailyBudget(totalBudgetUSD: number, totalDays: number): number {
	return totalBudgetUSD / totalDays;
}

// 用户信息
export interface User {
	name: string;
	totalBudgetUSD: number;
	startDate: string;
	endDate: string;
}

export const users: User[] = [
	{ name: 'Joey', totalBudgetUSD: 700, startDate: '2025-05-10', endDate: '2025-05-23' },
	{ name: 'Mia', totalBudgetUSD: 350, startDate: '2025-05-10', endDate: '2025-05-16' },
	{ name: 'Eddie', totalBudgetUSD: 650, startDate: '2025-05-11', endDate: '2025-05-23' },
];
