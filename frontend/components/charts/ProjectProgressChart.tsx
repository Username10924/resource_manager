import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ProjectProgressChartProps {
  data: {
    name: string;
    progress: number;
  }[];
}

const getProgressColor = (progress: number) => {
  if (progress >= 75) return '#18181b';
  if (progress >= 50) return '#52525b';
  if (progress >= 25) return '#a1a1aa';
  return '#d4d4d8';
};

export default function ProjectProgressChart({ data }: ProjectProgressChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 10, right: 30, left: 100, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
        <XAxis
          type="number"
          stroke="#a1a1aa"
          style={{ fontSize: '12px' }}
          domain={[0, 100]}
        />
        <YAxis
          type="category"
          dataKey="name"
          stroke="#a1a1aa"
          style={{ fontSize: '11px' }}
          width={90}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e4e4e7',
            borderRadius: '6px',
            boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
            fontSize: '13px',
          }}
          formatter={(value: number | undefined) => value !== undefined ? [`${value}%`, 'Progress'] : ['', '']}
        />
        <Bar dataKey="progress" radius={[0, 4, 4, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getProgressColor(entry.progress)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
