import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ProjectProgressChartProps {
  data: {
    name: string;
    progress: number;
  }[];
}

const getProgressColor = (progress: number) => {
  if (progress >= 75) return '#059669';  // emerald-600
  if (progress >= 50) return '#2563eb';  // blue-600
  if (progress >= 25) return '#d97706';  // amber-600
  return '#dc2626';  // red-600
};

export default function ProjectProgressChart({ data }: ProjectProgressChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 10, right: 30, left: 100, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
        <XAxis
          type="number"
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
          domain={[0, 100]}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <YAxis
          type="category"
          dataKey="name"
          stroke="#6b7280"
          style={{ fontSize: '11px' }}
          width={90}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
            fontSize: '13px',
          }}
          formatter={(value: number | undefined) => value !== undefined ? [`${value}%`, 'Progress'] : ['', '']}
        />
        <Bar dataKey="progress" radius={[0, 6, 6, 0]} maxBarSize={24} background={{ fill: '#f3f4f6', radius: [0, 6, 6, 0] as any }}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getProgressColor(entry.progress)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
