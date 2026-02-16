import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface DepartmentPieChartProps {
  data: {
    name: string;
    value: number;
  }[];
}

const COLORS = ['#18181b', '#52525b', '#a1a1aa', '#d4d4d8', '#71717a', '#3f3f46', '#e4e4e7', '#27272a'];

export default function DepartmentPieChart({ data }: DepartmentPieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => percent !== undefined ? `${name}: ${(percent * 100).toFixed(0)}%` : name}
          outerRadius={100}
          fill="#18181b"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e4e4e7',
            borderRadius: '6px',
            boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
            fontSize: '13px',
          }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
