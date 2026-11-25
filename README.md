# Mis Finanzas

Aplicación personal para registrar ingresos, gastos, deudas y gastos de la moto. Funciona en celular y computador y se puede instalar como PWA. Los registros requieren conexión para sincronizarse con Supabase; no se guardan cambios sin conexión.

## Requisitos

- Node.js 20 o posterior y npm
- Un proyecto Supabase

## Configuración

1. En Supabase, abre **SQL Editor** y ejecuta en orden los archivos de `supabase/migrations/`: `202611240001_initial_schema.sql`, `202611240002_historical_motorcycle_summary.sql` y `202611240003_motorcycle_odometer.sql`.
2. En **Authentication → Providers → Email**, habilita Email y conserva la confirmación de correo.
3. Copia `.env.example` como `.env.local` y define `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` desde **Project Settings → API**.
4. Instala dependencias e inicia la aplicación:

   ```sh
   npm install
   npm run dev
   ```

5. Crea tu usuario personal desde **Authentication → Users → Add user**, confirma el correo si Supabase lo solicita y luego inicia sesión en la app. La interfaz no permite crear cuentas nuevas. Para producción, configura en Supabase las URL de redirección permitidas para tu dominio.

La clave `anon`/publishable está destinada al cliente y está protegida por las políticas RLS de la migración. No uses una clave `service_role` en el navegador ni la guardes en `.env.local`.

## Funciones

- Resumen mensual de ingresos, gastos, saldos pendientes, abonos e inversión en la moto.
- Movimientos generales con categorías editables al registrar.
- Deudas con tipo, monto inicial, saldo, fecha de vencimiento, notas e historial de abonos.
- Los abonos se registran de forma atómica y no pueden superar el saldo pendiente.
- Gastos de la moto por categoría; las tanqueadas guardan costo, fecha y km por galón ingresados manualmente.
- Un resumen histórico estimado de la moto se excluye de los gastos mensuales; desde entonces, las tanqueadas se registran individualmente.
- El panel de la moto presenta kilómetros actuales, promedios históricos y mensuales de km/galón, y gastos mensuales e históricos.
- Interfaz adaptable e instalable. La PWA almacena la interfaz para abrirla, pero las operaciones de datos necesitan conexión.

Los abonos a deuda se muestran aparte de los gastos para evitar contar el mismo dinero dos veces como gasto y como reducción de deuda.

## Validación

```sh
npm run build
```
