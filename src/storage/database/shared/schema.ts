import { pgTable, serial, timestamp, varchar, date, numeric, index } from "drizzle-orm/pg-core"


export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 预算表 - 存储每个用户的预算信息
export const budgets = pgTable(
	"budgets",
	{
		id: serial().primaryKey(),
		userName: varchar("user_name", { length: 50 }).notNull(),
		totalBudgetUsd: numeric("total_budget_usd", { precision: 10, scale: 2 }).notNull(),
		startDate: date("start_date").notNull(),
		endDate: date("end_date").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
	},
	(table) => [
		index("budgets_user_name_idx").on(table.userName),
	]
);

// 消费记录表 - 存储每笔消费
export const expenses = pgTable(
	"expenses",
	{
		id: serial().primaryKey(),
		userName: varchar("user_name", { length: 50 }).notNull(),
		expenseDate: date("expense_date").notNull(),
		currency: varchar("currency", { length: 10 }).notNull(),
		amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
		amountUsd: numeric("amount_usd", { precision: 10, scale: 2 }).notNull(),
		expenseType: varchar("expense_type", { length: 50 }).notNull(),
		description: varchar("description", { length: 255 }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("expenses_user_name_idx").on(table.userName),
		index("expenses_expense_date_idx").on(table.expenseDate),
		index("expenses_user_date_idx").on(table.userName, table.expenseDate),
	]
);
