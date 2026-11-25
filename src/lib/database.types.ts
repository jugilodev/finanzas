export type TransactionKind = "income" | "expense";
export type TransactionScope = "general" | "motorcycle";
export type DebtKind = "loan" | "credit_card" | "other";

export type Transaction = {
  id: string;
  user_id: string;
  kind: TransactionKind;
  scope: TransactionScope;
  category: string;
  amount: number;
  occurred_on: string;
  note: string | null;
  km_per_gallon: number | null;
  created_at: string;
};

export type Debt = {
  id: string;
  user_id: string;
  name: string;
  kind: DebtKind;
  original_amount: number;
  balance_amount: number;
  due_date: string | null;
  note: string | null;
  created_at: string;
};

export type DebtPayment = {
  id: string;
  user_id: string;
  debt_id: string;
  amount: number;
  payment_date: string;
  note: string | null;
  created_at: string;
};

type TableShape<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      transactions: TableShape<
        Transaction,
        Omit<Transaction, "id" | "created_at"> & Partial<Pick<Transaction, "id" | "created_at">>,
        Partial<Omit<Transaction, "id" | "user_id" | "created_at">>
      >;
      debts: TableShape<
        Debt,
        Omit<Debt, "id" | "created_at"> & Partial<Pick<Debt, "id" | "created_at">>,
        Partial<Omit<Debt, "id" | "user_id" | "created_at">>
      >;
      debt_payments: TableShape<
        DebtPayment,
        Omit<DebtPayment, "id" | "created_at"> & Partial<Pick<DebtPayment, "id" | "created_at">>,
        never
      >;
    };
    Views: { [_ in never]: never };
    Functions: {
      record_debt_payment: {
        Args: {
          p_debt_id: string;
          p_amount: number;
          p_payment_date: string;
          p_note?: string | null;
        };
        Returns: DebtPayment;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
