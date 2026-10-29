import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DashboardSummary } from '../../types/api';
import { formatBucket, formatMoney, formatNumber } from '../../lib/format';

export function ActivityChart({
  trend,
  currency,
  granularity,
}: {
  trend: DashboardSummary['trend'];
  currency: string;
  granularity: 'hour' | 'day';
}) {
  return (
    <div className="h-[248px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={trend} margin={{ top: 8, right: 4, bottom: 0, left: -10 }}>
          <defs>
            <linearGradient id="activityValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity={0.24} />
              <stop offset="100%" stopColor="#2563eb" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8edf4" />
          <XAxis
            dataKey="bucket"
            tickFormatter={(value: string) => formatBucket(value, granularity)}
            tick={{ fontSize: 10, fill: '#64748b' }}
            axisLine={{ stroke: '#e4e9f0' }}
            tickLine={false}
            minTickGap={18}
          />
          <YAxis
            yAxisId="value"
            tickFormatter={(value: number) =>
              formatMoney(value, currency, { compact: true, maximumFractionDigits: 0 })
            }
            tick={{ fontSize: 10, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <YAxis
            yAxisId="count"
            orientation="right"
            allowDecimals={false}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            width={24}
          />
          <RechartsTooltip
            cursor={{ stroke: '#bfdbfe', strokeWidth: 1 }}
            contentStyle={{
              borderRadius: 10,
              border: '1px solid #e4e9f0',
              boxShadow: '0 12px 30px -18px rgb(8 14 26 / 0.4)',
              fontSize: 11,
              padding: '8px 10px',
            }}
            labelFormatter={(label) => formatBucket(String(label), granularity)}
            formatter={(value, name) =>
              name === 'Payment count'
                ? [formatNumber(Number(value)), 'Attempts']
                : [formatMoney(Number(value), currency), 'Attempt value']
            }
          />
          <Bar
            yAxisId="count"
            dataKey="count"
            name="Payment count"
            fill="#cbd5e1"
            barSize={12}
            radius={[3, 3, 0, 0]}
          />
          <Area
            yAxisId="value"
            type="monotone"
            dataKey="value"
            name="Attempt value"
            stroke="#2563eb"
            strokeWidth={2}
            fill="url(#activityValue)"
            activeDot={{ r: 3.5, strokeWidth: 2, stroke: '#ffffff' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
