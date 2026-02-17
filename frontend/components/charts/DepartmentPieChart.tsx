import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface DepartmentPieChartProps {
  data: {
    name: string;
    value: number;
  }[];
}

const COLORS = [
  '#2563eb', // blue-600
  '#0d9488', // teal-600
  '#d97706', // amber-600
  '#7c3aed', // violet-600
  '#dc2626', // red-600
  '#059669', // emerald-600
  '#db2777', // pink-600
  '#4f46e5', // indigo-600
  '#0284c7', // sky-600
  '#ca8a04', // yellow-600
];

const renderLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
  name,
}: any) => {
  if (percent < 0.04) return null;

  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 24;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#374151"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={11}
      fontWeight={500}
    >
      {`${name} (${(percent * 100).toFixed(0)}%)`}
    </text>
  );
};

export default function DepartmentPieChart({ data }: DepartmentPieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          labelLine={{ stroke: '#d1d5db', strokeWidth: 1 }}
          label={renderLabel}
          outerRadius={95}
          innerRadius={45}
          fill="#2563eb"
          dataKey="value"
          paddingAngle={2}
          strokeWidth={2}
          stroke="#fff"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
            fontSize: '13px',
          }}
          formatter={(value: number | undefined) => value !== undefined ? [`${value} employee${value !== 1 ? 's' : ''}`, 'Count'] : ['', '']}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
