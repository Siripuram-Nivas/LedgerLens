import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import type { PaymentStatus } from '../../types/api';
import { paymentStatusMeta, statusChartColors } from '../../lib/status';
import { formatNumber, formatPercent } from '../../lib/format';

export function PaymentStatusDonut({
  data,
  total,
}: {
  data: Array<{ status: PaymentStatus; count: number }>;
  total: number;
}) {
  const visible = data.filter((entry) => entry.count > 0);

  return (
    <div>
      <div className="relative mx-auto h-[168px] w-full max-w-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={visible}
              dataKey="count"
              nameKey="status"
              innerRadius={56}
              outerRadius={78}
              paddingAngle={2}
              stroke="none"
            >
              {visible.map((entry) => (
                <Cell
                  key={entry.status}
                  fill={statusChartColors[entry.status] ?? '#94a3b8'}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tracking-tight text-ink tabular">
            {formatNumber(total)}
          </span>
          <span className="text-[10px] uppercase tracking-[0.1em] text-muted">payments</span>
        </div>
      </div>
      <ul className="mt-3 space-y-1.5">
        {data.map((entry) => (
          <li key={entry.status} className="flex items-center gap-2 text-[11px]">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: statusChartColors[entry.status] ?? '#94a3b8' }}
              aria-hidden
            />
            <span className="flex-1 text-muted">{paymentStatusMeta[entry.status].label}</span>
            <span className="font-semibold text-ink-soft tabular">{formatNumber(entry.count)}</span>
            <span className="w-9 text-right text-muted-light tabular">
              {total > 0 ? formatPercent(entry.count / total) : '—'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
