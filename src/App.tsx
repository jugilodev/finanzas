import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bike,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Fuel,
  Gauge,
  History,
  LayoutDashboard,
  LogOut,
  Plus,
  ReceiptText,
  ShieldCheck,
  Wallet,
  Wrench,
  X
} from "lucide-react";
import type { Debt, DebtKind, DebtPayment, Transaction, TransactionKind, TransactionScope } from "./lib/database.types";
import { supabase } from "./lib/supabase";

type Page = "overview" | "transactions" | "debts" | "motorcycle";
type Notice = { kind: "error" | "success"; text: string };

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0
});

const dateToday = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
};

const dateLabel = (value: string | null) => {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" })
    .format(new Date(`${value}T00:00:00`));
};

const debtKindLabel: Record<DebtKind, string> = {
  loan: "Préstamo",
  credit_card: "Tarjeta de crédito",
  other: "Otra deuda"
};

const motorcycleCategories = ["Tanqueada", "Llantas", "Mantenimiento", "Repuestos", "Accesorios", "Otro"];
const generalCategories = ["Comida", "Gasolina", "Hogar", "Ropa", "Salud", "Servicios", "Transporte", "Otro"];
const incomeCategories = ["Salario", "Negocio", "Inversión", "Otro ingreso"];
const initialMotorcycleKm = 26692;
const efficiencyLabel = (value: number | null) =>
  value === null ? "—" : `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(value)} km/gal`;

function average(values: number[]) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Ocurrió un error inesperado. Intenta de nuevo.";
}

function AuthScreen() {
  const client = supabase;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!client) {
    return (
      <main className="auth-page">
        <div className="auth-card config-card">
          <div className="brand-mark"><Wallet size={23} /></div>
          <p className="eyebrow">CONFIGURACIÓN INICIAL</p>
          <h1>Conecta tu espacio financiero</h1>
          <p className="muted">Agrega la URL y la clave pública de tu proyecto Supabase en el archivo <code>.env.local</code>. Sigue los pasos de configuración del README.</p>
          <div className="security-note"><ShieldCheck size={18} /> Tus datos se protegen con autenticación y políticas de acceso por usuario.</div>
        </div>
      </main>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) return;
    setBusy(true);
    setError("");
    try {
      const result = await client.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-mark"><Wallet size={23} /></div>
        <p className="eyebrow">TUS FINANZAS, EN ORDEN</p>
        <h1>Qué bueno verte</h1>
        <p className="muted">Un espacio personal para tu dinero, tus metas y tu moto.</p>
        <form className="stack-form auth-form" onSubmit={submit}>
          <label>Correo electrónico<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" /></label>
          <label>Contraseña<input type="password" autoComplete="current-password" minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Tu contraseña" /></label>
          {error && <p className="notice error">{error}</p>}
          <button className="button primary full-button" disabled={busy}>{busy ? "Un momento..." : "Iniciar sesión"}<ChevronRight size={17} /></button>
        </form>
        <div className="security-note"><ShieldCheck size={18} /> Solo tú puedes ver tus registros.</div>
      </section>
    </main>
  );
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [page, setPage] = useState<Page>("overview");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [showHistoricalSummaryForm, setShowHistoricalSummaryForm] = useState(false);
  const [paymentDebt, setPaymentDebt] = useState<Debt | null>(null);
  const [transactionKind, setTransactionKind] = useState<TransactionKind>("expense");
  const [scope, setScope] = useState<TransactionScope>("general");
  const [category, setCategory] = useState(generalCategories[0]);
  const [amount, setAmount] = useState("");
  const [occurredOn, setOccurredOn] = useState(dateToday());
  const [note, setNote] = useState("");
  const [kmPerGallon, setKmPerGallon] = useState("");
  const [odometerKm, setOdometerKm] = useState("");
  const [historicalOdometerKm, setHistoricalOdometerKm] = useState("27101");
  const [historicalAverageKmPerGallon, setHistoricalAverageKmPerGallon] = useState("165");
  const [historicalPricePerGallon, setHistoricalPricePerGallon] = useState("16000");
  const [historicalCurrentTankKm, setHistoricalCurrentTankKm] = useState("409");
  const [debtName, setDebtName] = useState("");
  const [debtKind, setDebtKind] = useState<DebtKind>("loan");
  const [debtOriginal, setDebtOriginal] = useState("");
  const [debtBalance, setDebtBalance] = useState("");
  const [debtDueDate, setDebtDueDate] = useState("");
  const [debtNote, setDebtNote] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(dateToday());
  const [paymentNote, setPaymentNote] = useState("");

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    let active = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setNotice({ kind: "error", text: error.message });
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !session) {
      setTransactions([]);
      setDebts([]);
      setPayments([]);
      return;
    }
    let active = true;
    setDataLoading(true);
    void Promise.all([
      supabase.from("transactions").select("*").order("occurred_on", { ascending: false }),
      supabase.from("debts").select("*").order("due_date", { ascending: true, nullsFirst: false }),
      supabase.from("debt_payments").select("*").order("payment_date", { ascending: false })
    ]).then(([transactionResult, debtResult, paymentResult]) => {
      if (!active) return;
      const error = transactionResult.error ?? debtResult.error ?? paymentResult.error;
      if (error) throw error;
      setTransactions(transactionResult.data ?? []);
      setDebts(debtResult.data ?? []);
      setPayments(paymentResult.data ?? []);
    }).catch((loadError: unknown) => {
      if (active) setNotice({ kind: "error", text: getErrorMessage(loadError) });
    }).finally(() => {
      if (active) setDataLoading(false);
    });
    return () => { active = false; };
  }, [session, refreshKey]);

  const currentMonth = dateToday().slice(0, 7);
  const monthlyTransactions = transactions.filter((item) => !item.is_historical_summary && item.occurred_on.startsWith(currentMonth));
  const monthlyIncome = monthlyTransactions.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amount, 0);
  const monthlyExpenses = monthlyTransactions.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0);
  const outstandingDebt = debts.reduce((sum, debt) => sum + debt.balance_amount, 0);
  const motorcycleSpend = monthlyTransactions.filter((item) => item.scope === "motorcycle").reduce((sum, item) => sum + item.amount, 0);
  const motorcycleTransactions = transactions.filter((item) => item.scope === "motorcycle" && item.kind === "expense");
  const historicalMotorcycleSpend = motorcycleTransactions.reduce((sum, item) => sum + item.amount, 0);
  const motorcycleFuelRecords = motorcycleTransactions.filter(
    (item): item is Transaction & { km_per_gallon: number } => item.km_per_gallon !== null
  );
  const historicalKmPerGallon = average(motorcycleFuelRecords.map((item) => item.km_per_gallon));
  const monthlyKmPerGallon = average(motorcycleFuelRecords
    .filter((item) => !item.is_historical_summary && item.category === "Tanqueada" && item.occurred_on.startsWith(currentMonth))
    .map((item) => item.km_per_gallon));
  const motorcycleTotalKm = transactions.reduce(
    (current, item) => item.scope === "motorcycle" && item.odometer_km !== null
      ? Math.max(current, item.odometer_km)
      : current,
    initialMotorcycleKm
  );
  const historicalGallons = Number(historicalOdometerKm) / Number(historicalAverageKmPerGallon);
  const historicalEstimatedCost = historicalGallons * Number(historicalPricePerGallon);
  const historicalCurrentTankGallons = Number(historicalCurrentTankKm) / Number(historicalAverageKmPerGallon);
  const monthlyPayments = payments.filter((item) => item.payment_date.startsWith(currentMonth)).reduce((sum, item) => sum + item.amount, 0);
  const visibleTransactions = useMemo(() => {
    if (page === "motorcycle") return transactions.filter((item) => item.scope === "motorcycle");
    return transactions.filter((item) => item.scope === "general");
  }, [page, transactions]);

  async function refresh() {
    setRefreshKey((key) => key + 1);
  }

  function openTransactionForm(targetScope: TransactionScope) {
    setScope(targetScope);
    setTransactionKind("expense");
    setCategory(targetScope === "motorcycle" ? motorcycleCategories[0] : generalCategories[0]);
    setAmount("");
    setOccurredOn(dateToday());
    setNote("");
    setKmPerGallon("");
    setOdometerKm("");
    setNotice(null);
    setShowTransactionForm(true);
    setShowDebtForm(false);
    setShowHistoricalSummaryForm(false);
    setPaymentDebt(null);
  }

  function openHistoricalSummaryForm() {
    setHistoricalOdometerKm("27101");
    setHistoricalAverageKmPerGallon("165");
    setHistoricalPricePerGallon("16000");
    setHistoricalCurrentTankKm("409");
    setNotice(null);
    setShowTransactionForm(false);
    setShowDebtForm(false);
    setShowHistoricalSummaryForm(true);
    setPaymentDebt(null);
  }

  function openDebtForm() {
    setDebtName("");
    setDebtKind("loan");
    setDebtOriginal("");
    setDebtBalance("");
    setDebtDueDate("");
    setDebtNote("");
    setNotice(null);
    setShowDebtForm(true);
    setShowTransactionForm(false);
    setShowHistoricalSummaryForm(false);
    setPaymentDebt(null);
  }

  function openPaymentForm(debt: Debt) {
    setPaymentDebt(debt);
    setPaymentAmount("");
    setPaymentDate(dateToday());
    setPaymentNote("");
    setNotice(null);
    setShowTransactionForm(false);
    setShowDebtForm(false);
    setShowHistoricalSummaryForm(false);
  }

  async function saveTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !session) return;
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setNotice({ kind: "error", text: "Ingresa un monto mayor a cero." });
      return;
    }
    if (scope === "motorcycle" && category === "Tanqueada") {
      const efficiency = Number(kmPerGallon);
      const odometer = Number(odometerKm);
      if (!Number.isFinite(efficiency) || efficiency <= 0 || !Number.isFinite(odometer) || odometer <= 0) {
        setNotice({ kind: "error", text: "Ingresa el rendimiento y el odómetro actual para registrar la tanqueada." });
        return;
      }
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("transactions").insert({
        user_id: session.user.id,
        kind: transactionKind,
        scope: transactionKind === "income" ? "general" : scope,
        category,
        amount: parsedAmount,
        occurred_on: occurredOn,
        note: note.trim() || null,
        km_per_gallon: scope === "motorcycle" && category === "Tanqueada" && kmPerGallon
          ? Number(kmPerGallon)
          : null,
        is_historical_summary: false,
        odometer_km: scope === "motorcycle" && category === "Tanqueada" && odometerKm
          ? Number(odometerKm)
          : null
      });
      if (error) throw error;
      setNotice({ kind: "success", text: transactionKind === "income" ? "Ingreso guardado." : "Gasto guardado." });
      setShowTransactionForm(false);
      await refresh();
    } catch (saveError) {
      setNotice({ kind: "error", text: getErrorMessage(saveError) });
    } finally {
      setBusy(false);
    }
  }

  async function saveHistoricalSummary(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !session) return;
    const totalKm = Number(historicalOdometerKm);
    const average = Number(historicalAverageKmPerGallon);
    const price = Number(historicalPricePerGallon);
    const currentTankKm = Number(historicalCurrentTankKm);
    if (
      !Number.isFinite(totalKm) || totalKm <= 0 ||
      !Number.isFinite(average) || average <= 0 ||
      !Number.isFinite(price) || price <= 0 ||
      !Number.isFinite(currentTankKm) || currentTankKm < 0 || currentTankKm > totalKm
    ) {
      setNotice({ kind: "error", text: "Revisa los datos: deben ser positivos y los km de la tanqueada actual no pueden superar el odómetro." });
      return;
    }

    const gallons = totalKm / average;
    const estimatedCost = Math.round(gallons * price * 100) / 100;
    const note = `Estimación acumulada desde 0 km: ${totalKm.toLocaleString("es-CO")} km, ${gallons.toFixed(2)} gal a ${money.format(price)}/gal. Incluye la tanqueada actual con ${currentTankKm.toLocaleString("es-CO")} km recorridos. No representa cargas individuales; el resumen no afecta los gastos mensuales.`;

    setBusy(true);
    try {
      const { error } = await supabase.from("transactions").insert({
        user_id: session.user.id,
        kind: "expense",
        scope: "motorcycle",
        category: "Resumen histórico",
        amount: estimatedCost,
        occurred_on: dateToday(),
        note,
        km_per_gallon: average,
        is_historical_summary: true,
        odometer_km: totalKm - currentTankKm
      });
      if (error) throw error;
      setNotice({ kind: "success", text: `Resumen histórico guardado: ${money.format(estimatedCost)} estimados.` });
      setShowHistoricalSummaryForm(false);
      await refresh();
    } catch (saveError) {
      setNotice({ kind: "error", text: getErrorMessage(saveError) });
    } finally {
      setBusy(false);
    }
  }

  async function saveDebt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !session) return;
    const original = Number(debtOriginal);
    const balance = Number(debtBalance || debtOriginal);
    if (!Number.isFinite(original) || original <= 0 || !Number.isFinite(balance) || balance < 0 || balance > original) {
      setNotice({ kind: "error", text: "Revisa los montos: el saldo debe estar entre cero y el monto inicial." });
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("debts").insert({
        user_id: session.user.id,
        name: debtName.trim(),
        kind: debtKind,
        original_amount: original,
        balance_amount: balance,
        due_date: debtDueDate || null,
        note: debtNote.trim() || null
      });
      if (error) throw error;
      setNotice({ kind: "success", text: "Deuda registrada." });
      setShowDebtForm(false);
      await refresh();
    } catch (saveError) {
      setNotice({ kind: "error", text: getErrorMessage(saveError) });
    } finally {
      setBusy(false);
    }
  }

  async function savePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !paymentDebt) return;
    const parsedAmount = Number(paymentAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > paymentDebt.balance_amount) {
      setNotice({ kind: "error", text: "El abono debe ser mayor a cero y no superar el saldo pendiente." });
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.rpc("record_debt_payment", {
        p_debt_id: paymentDebt.id,
        p_amount: parsedAmount,
        p_payment_date: paymentDate,
        p_note: paymentNote.trim() || null
      });
      if (error) throw error;
      setNotice({ kind: "success", text: "Abono registrado y saldo actualizado." });
      setPaymentDebt(null);
      await refresh();
    } catch (saveError) {
      setNotice({ kind: "error", text: getErrorMessage(saveError) });
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) setNotice({ kind: "error", text: error.message });
  }

  if (authLoading) {
    return <main className="auth-page"><div className="loading-card">Cargando tu espacio...</div></main>;
  }
  if (!supabase || !session) return <AuthScreen />;

  const pageTitle: Record<Page, string> = {
    overview: "Resumen",
    transactions: "Movimientos",
    debts: "Deudas",
    motorcycle: "Mi moto"
  };
  const pageDescription: Record<Page, string> = {
    overview: "Una mirada clara a tu dinero este mes.",
    transactions: "Todos tus ingresos y gastos generales.",
    debts: "Saldos, abonos y próximas fechas de pago.",
    motorcycle: "Cada gasto y cada tanqueada, en un solo lugar."
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setPage("overview"); }}>
          <span className="brand-mark"><Wallet size={21} /></span>
          <span>mis finanzas<small>PERSONAL</small></span>
        </a>
        <p className="nav-caption">MENÚ</p>
        <nav className="side-nav" aria-label="Navegación principal">
          <NavButton active={page === "overview"} onClick={() => setPage("overview")} icon={<LayoutDashboard size={19} />} label="Resumen" />
          <NavButton active={page === "transactions"} onClick={() => setPage("transactions")} icon={<ReceiptText size={19} />} label="Movimientos" />
          <NavButton active={page === "debts"} onClick={() => setPage("debts")} icon={<CreditCard size={19} />} label="Deudas" badge={debts.filter((debt) => debt.balance_amount > 0).length} />
          <NavButton active={page === "motorcycle"} onClick={() => setPage("motorcycle")} icon={<Bike size={19} />} label="Mi moto" />
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-card"><ShieldCheck size={17} /><span>Tu información es privada y solo tú puedes acceder.</span></div>
          <button className="account-button" onClick={() => void signOut()}>
            <span className="avatar">{session.user.email?.slice(0, 1).toUpperCase() ?? "U"}</span>
            <span className="account-email">{session.user.email}<small>Cerrar sesión</small></span>
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="page-header">
          <div><p className="eyebrow">{new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" }).format(new Date())}</p><h1>{pageTitle[page]}</h1><p className="muted">{pageDescription[page]}</p></div>
          <button className="button primary header-action" onClick={() => openTransactionForm(page === "motorcycle" ? "motorcycle" : "general")}><Plus size={18} /> Registrar movimiento</button>
        </header>

        {notice && <div className={`notice page-notice ${notice.kind}`} role="status"><span>{notice.text}</span><button aria-label="Cerrar aviso" onClick={() => setNotice(null)}><X size={17} /></button></div>}
        {dataLoading && <div className="loading-line">Actualizando registros...</div>}

        {page === "motorcycle" && (
          <section className="metrics-grid motorcycle-metrics-grid">
            <MetricCard label="Km totales actuales" value={`${new Intl.NumberFormat("es-CO").format(motorcycleTotalKm)} km`} icon={<Bike size={19} />} tone="purple" foot="Odómetro más reciente registrado" />
            <MetricCard label="Promedio histórico" value={efficiencyLabel(historicalKmPerGallon)} icon={<Gauge size={19} />} tone="green" foot="Promedio de registros históricos" />
            <MetricCard label="Promedio del mes" value={efficiencyLabel(monthlyKmPerGallon)} icon={<Fuel size={19} />} tone="blue" foot="Tanqueadas individuales este mes" />
            <MetricCard label="Gastos de moto del mes" value={money.format(motorcycleSpend)} icon={<ArrowUpRight size={19} />} tone="orange" foot="Sin incluir el resumen histórico" />
            <MetricCard label="Gastos históricos de moto" value={money.format(historicalMotorcycleSpend)} icon={<History size={19} />} tone="purple" foot="Total acumulado registrado" />
          </section>
        )}

        {page === "overview" && (
          <>
            <section className="metrics-grid">
              <MetricCard label="Ingresos del mes" value={money.format(monthlyIncome)} icon={<ArrowDownLeft size={19} />} tone="green" foot="Entradas registradas" />
              <MetricCard label="Gastos del mes" value={money.format(monthlyExpenses)} icon={<ArrowUpRight size={19} />} tone="orange" foot="Gastos generales y de moto" />
              <MetricCard label="Deuda pendiente" value={money.format(outstandingDebt)} icon={<CreditCard size={19} />} tone="blue" foot={`${debts.filter((debt) => debt.balance_amount > 0).length} cuentas activas`} />
              <MetricCard label="Invertido en la moto" value={money.format(motorcycleSpend)} icon={<Bike size={19} />} tone="purple" foot="Gastos de moto este mes" />
            </section>
            <section className="overview-grid">
              <div className="panel recent-panel">
                <div className="panel-heading"><div><h2>Actividad reciente</h2><p>Lo último que has registrado</p></div><button className="text-button" onClick={() => setPage("transactions")}>Ver movimientos <ChevronRight size={15} /></button></div>
                {transactions.length === 0 ? <EmptyState title="Aún no hay movimientos" text="Registra tu primer ingreso o gasto para comenzar." /> : <TransactionList items={transactions.slice(0, 6)} />}
              </div>
              <div className="panel debt-summary">
                <div className="panel-heading"><div><h2>Deudas</h2><p>Saldo que te falta pagar</p></div><span className="round-icon blue"><CreditCard size={18} /></span></div>
                <strong className="summary-amount">{money.format(outstandingDebt)}</strong>
                <div className="summary-divider" />
                <div className="small-stat"><span>Abonos este mes</span><strong>{money.format(monthlyPayments)}</strong></div>
                <div className="small-stat"><span>Próximo vencimiento</span><strong>{dateLabel(debts.find((debt) => debt.balance_amount > 0 && debt.due_date)?.due_date ?? null)}</strong></div>
                <button className="button secondary full-button" onClick={() => setPage("debts")}>Revisar deudas <ChevronRight size={16} /></button>
              </div>
            </section>
            <div className="section-title"><div><h2>Accesos rápidos</h2><p>Registra algo sin perder tiempo</p></div></div>
            <section className="quick-grid">
              <QuickAction icon={<ArrowDownLeft size={19} />} title="Nuevo ingreso" text="Registra dinero que recibiste" onClick={() => { openTransactionForm("general"); setTransactionKind("income"); setCategory(incomeCategories[0]); }} />
              <QuickAction icon={<ReceiptText size={19} />} title="Nuevo gasto" text="Comida, ropa, servicios y más" onClick={() => openTransactionForm("general")} />
              <QuickAction icon={<CreditCard size={19} />} title="Agregar deuda" text="Préstamo, tarjeta u otra deuda" onClick={openDebtForm} />
              <QuickAction icon={<Fuel size={19} />} title="Tanqueada" text="Agrega gasto y km por galón" onClick={() => openTransactionForm("motorcycle")} />
            </section>
          </>
        )}

        {(page === "transactions" || page === "motorcycle") && (
          <section className="panel records-panel">
            <div className="panel-heading records-heading"><div><h2>{page === "motorcycle" ? "Registro de la moto" : "Historial de movimientos"}</h2><p>{visibleTransactions.length} registros guardados</p></div><div className="panel-actions">{page === "motorcycle" && !transactions.some((item) => item.is_historical_summary) && <button className="button secondary compact-button" onClick={openHistoricalSummaryForm}><History size={15} /> Cargar acumulado</button>}<button className="button secondary compact-button" onClick={() => openTransactionForm(page === "motorcycle" ? "motorcycle" : "general")}><Plus size={16} /> Agregar</button></div></div>
            {page === "motorcycle" && <div className="motorcycle-highlight"><span className="round-icon purple"><Bike size={20} /></span><div><strong>{money.format(transactions.filter((item) => item.scope === "motorcycle").reduce((sum, item) => sum + item.amount, 0))}</strong><small>Inversión total registrada en la moto</small></div><span className="moto-count">{transactions.filter((item) => item.scope === "motorcycle" && item.category === "Tanqueada" && !item.is_historical_summary).length} tanqueadas individuales</span></div>}
            {visibleTransactions.length === 0 ? <EmptyState title="Sin registros todavía" text={page === "motorcycle" ? "Anota tu primera tanqueada, mantenimiento o repuesto." : "Tus ingresos y gastos aparecerán aquí."} /> : <TransactionList items={visibleTransactions} />}
          </section>
        )}

        {page === "debts" && (
          <section className="panel records-panel">
            <div className="panel-heading records-heading"><div><h2>Mis deudas</h2><p>El saldo se actualiza con cada abono</p></div><button className="button primary compact-button" onClick={openDebtForm}><Plus size={16} /> Nueva deuda</button></div>
            {debts.length === 0 ? <EmptyState title="No has registrado deudas" text="Agrega préstamos, tarjetas de crédito u otras cuentas pendientes." /> : (
              <div className="debt-list">
                {debts.map((debt) => {
                  const debtPayments = payments.filter((payment) => payment.debt_id === debt.id);
                  const paid = debt.original_amount - debt.balance_amount;
                  const progress = debt.original_amount > 0 ? Math.min(100, Math.round(paid / debt.original_amount * 100)) : 0;
                  return (
                    <article className="debt-card" key={debt.id}>
                      <div className="debt-card-top"><div className="debt-ident"><span className="round-icon blue"><CreditCard size={18} /></span><div><h3>{debt.name}</h3><span>{debtKindLabel[debt.kind]}</span></div></div><span className={`debt-status ${debt.balance_amount === 0 ? "paid" : ""}`}>{debt.balance_amount === 0 ? "Pagada" : "Pendiente"}</span></div>
                      <div className="debt-amounts"><div><small>Te falta</small><strong>{money.format(debt.balance_amount)}</strong></div><div><small>Monto inicial</small><strong>{money.format(debt.original_amount)}</strong></div><div><small>Vencimiento</small><strong><CalendarDays size={14} /> {dateLabel(debt.due_date)}</strong></div></div>
                      <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
                      <div className="progress-caption"><span>{money.format(paid)} abonados</span><span>{progress}%</span></div>
                      {debt.note && <p className="debt-note">{debt.note}</p>}
                      {debtPayments.length > 0 && <div className="payment-history"><strong>Últimos abonos</strong>{debtPayments.slice(0, 3).map((payment) => <div key={payment.id}><span>{dateLabel(payment.payment_date)}{payment.note ? ` · ${payment.note}` : ""}</span><b>{money.format(payment.amount)}</b></div>)}</div>}
                      {debt.balance_amount > 0 && <button className="button secondary full-button" onClick={() => openPaymentForm(debt)}><CircleDollarSign size={17} /> Registrar abono</button>}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {showTransactionForm && (
          <FormOverlay title={scope === "motorcycle" ? "Nuevo gasto de la moto" : "Nuevo movimiento"} onClose={() => setShowTransactionForm(false)}>
            <form className="stack-form" onSubmit={saveTransaction}>
              <div className="segmented-control">
                <button type="button" className={transactionKind === "expense" ? "selected" : ""} onClick={() => { setTransactionKind("expense"); setCategory(scope === "motorcycle" ? motorcycleCategories[0] : generalCategories[0]); }}>Gasto</button>
                {scope === "general" && <button type="button" className={transactionKind === "income" ? "selected" : ""} onClick={() => { setTransactionKind("income"); setCategory(incomeCategories[0]); }}>Ingreso</button>}
              </div>
              <div className="form-row">
                <label>Categoría<select value={category} onChange={(event) => { setCategory(event.target.value); if (event.target.value !== "Tanqueada") { setKmPerGallon(""); setOdometerKm(""); } }}>{(transactionKind === "income" ? incomeCategories : scope === "motorcycle" ? motorcycleCategories : generalCategories).map((item) => <option key={item}>{item}</option>)}</select></label>
                <label>Monto (COP)<input type="number" min="1" step="1" required value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" /></label>
              </div>
              {scope === "motorcycle" && category === "Tanqueada" && <div className="form-row"><label>Rendimiento (km por galón)<input type="number" min="0.01" step="0.01" required value={kmPerGallon} onChange={(event) => setKmPerGallon(event.target.value)} placeholder="Ej. 165" /><small className="field-hint">Ingresa el promedio que calculaste para esta tanqueada.</small></label><label>Odómetro actual (km)<input type="number" min="0.1" step="0.1" required value={odometerKm} onChange={(event) => setOdometerKm(event.target.value)} placeholder="Ej. 27101" /><small className="field-hint">Actualiza el cuadro de kilómetros totales.</small></label></div>}
              <div className="form-row"><label>Fecha<input type="date" required value={occurredOn} onChange={(event) => setOccurredOn(event.target.value)} /></label><label>Nota (opcional)<input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Un detalle para recordar" /></label></div>
              <div className="form-actions"><button type="button" className="button secondary" onClick={() => setShowTransactionForm(false)}>Cancelar</button><button className="button primary" disabled={busy}>{busy ? "Guardando..." : "Guardar registro"}<Check size={16} /></button></div>
            </form>
          </FormOverlay>
        )}

        {showHistoricalSummaryForm && (
          <FormOverlay title="Cargar resumen histórico" onClose={() => setShowHistoricalSummaryForm(false)}>
            <p className="historical-explanation">Se guardará un único resumen estimado, no tanqueadas individuales. Este importe cuenta en la inversión total de la moto, pero queda fuera de los gastos mensuales.</p>
            <form className="stack-form" onSubmit={saveHistoricalSummary}>
              <label>Odómetro acumulado desde 0 km<input type="number" min="0.01" step="0.01" required value={historicalOdometerKm} onChange={(event) => setHistoricalOdometerKm(event.target.value)} /></label>
              <div className="form-row"><label>Promedio (km/galón)<input type="number" min="0.01" step="0.01" required value={historicalAverageKmPerGallon} onChange={(event) => setHistoricalAverageKmPerGallon(event.target.value)} /></label><label>Precio por galón (COP)<input type="number" min="1" step="1" required value={historicalPricePerGallon} onChange={(event) => setHistoricalPricePerGallon(event.target.value)} /></label></div>
              <label>Km recorridos en la tanqueada actual<input type="number" min="0" step="0.01" required value={historicalCurrentTankKm} onChange={(event) => setHistoricalCurrentTankKm(event.target.value)} /></label>
              <div className="historical-estimate"><span>Consumo estimado acumulado<strong>{Number.isFinite(historicalGallons) ? `${historicalGallons.toFixed(2)} gal` : "—"}</strong></span><span>Gasto estimado<strong>{Number.isFinite(historicalEstimatedCost) ? money.format(historicalEstimatedCost) : "—"}</strong></span><small>Los 409 km actuales se incluyen en el cálculo acumulado.</small><small>De esos km actuales: {Number.isFinite(historicalCurrentTankGallons) ? `${historicalCurrentTankGallons.toFixed(2)} gal` : "—"} estimados.</small></div>
              <div className="form-actions"><button type="button" className="button secondary" onClick={() => setShowHistoricalSummaryForm(false)}>Cancelar</button><button className="button primary" disabled={busy}>{busy ? "Guardando..." : "Guardar resumen"}<Check size={16} /></button></div>
            </form>
          </FormOverlay>
        )}

        {showDebtForm && (
          <FormOverlay title="Registrar deuda" onClose={() => setShowDebtForm(false)}>
            <form className="stack-form" onSubmit={saveDebt}>
              <label>Nombre de la deuda<input required value={debtName} onChange={(event) => setDebtName(event.target.value)} placeholder="Ej. Tarjeta principal, préstamo..." /></label>
              <div className="form-row"><label>Tipo<select value={debtKind} onChange={(event) => setDebtKind(event.target.value as DebtKind)}><option value="loan">Préstamo</option><option value="credit_card">Tarjeta de crédito</option><option value="other">Otra</option></select></label><label>Fecha de vencimiento<input type="date" value={debtDueDate} onChange={(event) => setDebtDueDate(event.target.value)} /></label></div>
              <div className="form-row"><label>Monto inicial (COP)<input type="number" min="1" step="1" required value={debtOriginal} onChange={(event) => { const nextValue = event.target.value; setDebtOriginal(nextValue); setDebtBalance((current) => !current || current === debtOriginal ? nextValue : current); }} placeholder="0" /></label><label>Saldo actual (COP)<input type="number" min="0" step="1" required value={debtBalance} onChange={(event) => setDebtBalance(event.target.value)} placeholder="Igual al inicial" /></label></div>
              <label>Nota (opcional)<input value={debtNote} onChange={(event) => setDebtNote(event.target.value)} placeholder="Información adicional" /></label>
              <div className="form-actions"><button type="button" className="button secondary" onClick={() => setShowDebtForm(false)}>Cancelar</button><button className="button primary" disabled={busy}>{busy ? "Guardando..." : "Guardar deuda"}<Check size={16} /></button></div>
            </form>
          </FormOverlay>
        )}

        {paymentDebt && (
          <FormOverlay title={`Abonar a ${paymentDebt.name}`} onClose={() => setPaymentDebt(null)}>
            <p className="payment-balance">Saldo pendiente: <strong>{money.format(paymentDebt.balance_amount)}</strong></p>
            <form className="stack-form" onSubmit={savePayment}>
              <label>Monto del abono (COP)<input type="number" min="1" max={paymentDebt.balance_amount} step="1" required value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} placeholder="0" /></label>
              <label>Fecha del abono<input type="date" required value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></label>
              <label>Nota (opcional)<input value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} placeholder="Ej. pago mínimo, cuota 4..." /></label>
              <div className="form-actions"><button type="button" className="button secondary" onClick={() => setPaymentDebt(null)}>Cancelar</button><button className="button primary" disabled={busy}>{busy ? "Guardando..." : "Guardar abono"}<Check size={16} /></button></div>
            </form>
          </FormOverlay>
        )}
      </main>
      <nav className="mobile-nav" aria-label="Navegación móvil">
        <NavButton active={page === "overview"} onClick={() => setPage("overview")} icon={<LayoutDashboard size={19} />} label="Inicio" />
        <NavButton active={page === "transactions"} onClick={() => setPage("transactions")} icon={<ReceiptText size={19} />} label="Gastos" />
        <NavButton active={page === "debts"} onClick={() => setPage("debts")} icon={<CreditCard size={19} />} label="Deudas" />
        <NavButton active={page === "motorcycle"} onClick={() => setPage("motorcycle")} icon={<Bike size={19} />} label="Moto" />
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: ReactNode; label: string; badge?: number }) {
  return <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>{icon}<span>{label}</span>{badge ? <small>{badge}</small> : null}</button>;
}

function MetricCard({ label, value, icon, tone, foot }: { label: string; value: string; icon: ReactNode; tone: string; foot: string }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><span className={`round-icon ${tone}`}>{icon}</span></div><strong>{value}</strong><small>{foot}</small></article>;
}

function QuickAction({ icon, title, text, onClick }: { icon: ReactNode; title: string; text: string; onClick: () => void }) {
  return <button className="quick-action" onClick={onClick}><span className="round-icon green">{icon}</span><span><strong>{title}</strong><small>{text}</small></span><ChevronRight size={17} className="quick-chevron" /></button>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><span className="empty-icon"><ReceiptText size={22} /></span><strong>{title}</strong><p>{text}</p></div>;
}

function TransactionList({ items }: { items: Transaction[] }) {
  return (
    <div className="transaction-list">
      {items.map((item) => (
        <article className="transaction-row" key={item.id}>
          <span className={`transaction-icon ${item.kind === "income" ? "positive" : item.scope === "motorcycle" ? "moto" : "negative"}`}>{item.scope === "motorcycle" ? item.category === "Tanqueada" ? <Fuel size={18} /> : <Wrench size={18} /> : item.kind === "income" ? <ArrowDownLeft size={18} /> : <ReceiptText size={18} />}</span>
          <span className="transaction-info"><strong>{item.category}</strong><small>{dateLabel(item.occurred_on)}{item.scope === "motorcycle" ? " · Moto" : ""}{item.km_per_gallon ? ` · ${item.km_per_gallon} km/gal` : ""}{item.note ? ` · ${item.note}` : ""}</small></span>
          <strong className={`transaction-amount ${item.kind === "income" ? "income" : ""}`}>{item.kind === "income" ? "+" : "−"}{money.format(item.amount)}</strong>
        </article>
      ))}
    </div>
  );
}

function FormOverlay({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="overlay-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="form-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-heading"><div><p className="eyebrow">NUEVO REGISTRO</p><h2 id="modal-title">{title}</h2></div><button className="icon-button" aria-label="Cerrar" onClick={onClose}><X size={20} /></button></div>
        {children}
      </section>
    </div>
  );
}

export { App };
