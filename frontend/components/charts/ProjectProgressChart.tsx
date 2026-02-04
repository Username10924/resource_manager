import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ProjectProgressChartProps {
  data: {
    name: string;
    progress: number;
  }[];
}

const getProgressColor = (progress: number) => {
  if (progress >= 75) return '#10b981'; // Green
  if (progress >= 50) return '#9ca3af'; // Gray
  if (progress >= 25) return '#f59e0b'; // Orange
  return '#ef4444'; // Red
};

export default function ProjectProgressChart({ data }: ProjectProgressChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart 
        data={data} 
        layout="vertical"
        margin={{ top: 10, right: 30, left: 100, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis 
          type="number"
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
          domain={[0, 100]}
        />
        <YAxis 
          type="category"
          dataKey="name"
          stroke="#6b7280"
          style={{ fontSize: '11px' }}
          width={90}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'white', 
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
          }}
          formatter={(value: number | undefined) => value !== undefined ? [`${value}%`, 'Progress'] : ['', '']}
        />
        <Bar dataKey="progress" radius={[0, 8, 8, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getProgressColor(entry.progress)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
