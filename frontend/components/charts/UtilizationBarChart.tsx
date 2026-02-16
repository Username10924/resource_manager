import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface UtilizationBarChartProps {
  data: {
    month: string;
    utilization: number;
  }[];
}

const getBarColor = (utilization: number) => {
  if (utilization >= 90) return '#ef4444';
  if (utilization >= 75) return '#18181b';
  if (utilization >= 50) return '#71717a';
  return '#d4d4d8';
};

export default function UtilizationBarChart({ data }: UtilizationBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
        <XAxis
          dataKey="month"
          stroke="#a1a1aa"
          style={{ fontSize: '12px' }}
        />
        <YAxis
          stroke="#a1a1aa"
          style={{ fontSize: '12px' }}
          label={{ value: 'Utilization %', angle: -90, position: 'insideLeft' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e4e4e7',
            borderRadius: '6px',
            boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
            fontSize: '13px',
          }}
          formatter={(value: number | undefined) => value !== undefined ? [`${value.toFixed(1)}%`, 'Utilization'] : ['', '']}
        />
        <Bar dataKey="utilization" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getBarColor(entry.utilization)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
