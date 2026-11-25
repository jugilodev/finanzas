# Mis Finanzas

Aplicación personal para registrar ingresos, gastos, deudas y gastos de la moto. Funciona en celular y computador y se puede instalar como PWA. Los registros requieren conexión para sincronizarse con Supabase; no se guardan cambios sin conexión.

## Requisitos

- Node.js 20 o posterior y npm
- Un proyecto Supabase

## Configuración

1. En Supabase, abre **SQL Editor** y ejecuta en orden todos los archivos de `supabase/migrations/`: `202611240001_initial_schema.sql`, `202611240002_historical_motorcycle_summary.sql`, `202611240003_motorcycle_odometer.sql`, `202611240004_motorcycle_fuel_measurements.sql` y `202611240005_edit_delete_debt_payments.sql`.
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
- Movimientos generales y gastos de moto que se pueden editar o eliminar.
- Deudas con tipo, monto inicial, saldo, fecha de vencimiento, notas e historial de abonos, todos editables o eliminables.
- Los abonos se registran, editan y eliminan de forma atómica; el saldo de la deuda se ajusta automáticamente.
- Para una tanqueada se registra el costo, kilómetros recorridos desde la carga anterior y galones comprados. La app calcula km/galón como km ÷ galones.
- El promedio de consumo se calcula de forma ponderada: suma de kilómetros ÷ suma de galones. El odómetro suma los kilómetros del resumen histórico y de cada tanqueada posterior.
- Un resumen histórico estimado de la moto se excluye de los gastos mensuales; desde entonces, las tanqueadas se registran individualmente.
- El panel de la moto presenta kilómetros actuales, promedios históricos y mensuales de km/galón, y gastos mensuales e históricos.
- Interfaz adaptable e instalable. La PWA almacena la interfaz para abrirla, pero las operaciones de datos necesitan conexión.

Los abonos a deuda se muestran aparte de los gastos para evitar contar el mismo dinero dos veces como gasto y como reducción de deuda.

Al terminar las migraciones, abre **Mi moto → Cargar acumulado** para guardar la base histórica estimada de 26.692 km, 165 km/galón y $16.000 COP por galón. La app la etiqueta como estimación y recalcula el promedio ponderado al agregar tanqueadas reales.

## Validación

```sh
npm run build
```
