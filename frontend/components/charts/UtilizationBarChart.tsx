import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';

interface UtilizationBarChartProps {
  data: {
    month: string;
    utilization: number;
  }[];
}

const getBarColor = (utilization: number) => {
  if (utilization >= 90) return '#ef4444'; // Red - over-utilized
  if (utilization >= 75) return '#10b981'; // Green - good utilization
  if (utilization >= 50) return '#f59e0b'; // Orange - moderate
  return '#6b7280'; // Gray - low utilization
};

export default function UtilizationBarChart({ data }: UtilizationBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis 
          dataKey="month" 
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
        />
        <YAxis 
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
          label={{ value: 'Utilization %', angle: -90, position: 'insideLeft' }}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'white', 
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
          }}
          formatter={(value: number | undefined) => value !== undefined ? [`${value.toFixed(1)}%`, 'Utilization'] : ['', '']}
        />
        <Bar dataKey="utilization" radius={[8, 8, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getBarColor(entry.utilization)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
