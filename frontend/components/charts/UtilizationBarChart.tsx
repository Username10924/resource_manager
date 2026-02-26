import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';

interface UtilizationBarChartProps {
  data: {
    month: string;
    utilization: number;
  }[];
  onBarClick?: (month: string) => void;
}

const getBarColor = (utilization: number) => {
  if (utilization >= 90) return '#dc2626';  // red-600
  if (utilization >= 75) return '#2563eb';  // blue-600
  if (utilization >= 50) return '#0d9488';  // teal-600
  if (utilization >= 25) return '#6366f1';  // indigo-500
  return '#94a3b8';  // slate-400
};

export default function UtilizationBarChart({ data, onBarClick }: UtilizationBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
        <XAxis
          dataKey="month"
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
          tickLine={false}
        />
        <YAxis
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
          tickLine={false}
          axisLine={false}
          domain={[0, 100]}
          label={{ value: 'Utilization %', angle: -90, position: 'insideLeft', style: { fontSize: '11px', fill: '#9ca3af' } }}
        />
        <ReferenceLine y={75} stroke="#2563eb" strokeDasharray="4 4" strokeOpacity={0.4} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
            fontSize: '13px',
          }}
          formatter={(value: number | undefined) => value !== undefined ? [`${value.toFixed(1)}%`, 'Utilization'] : ['', '']}
          cursor={{ fill: 'rgba(0,0,0,0.05)' }}
        />
        <Bar
          dataKey="utilization"
          radius={[6, 6, 0, 0]}
          maxBarSize={40}
          cursor={onBarClick ? 'pointer' : undefined}
          onClick={(barData) => {
            if (onBarClick && barData?.month) {
              onBarClick(barData.month);
            }
          }}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getBarColor(entry.utilization)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
