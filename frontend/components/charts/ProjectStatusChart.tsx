import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface ProjectStatusChartProps {
  data: {
    name: string;
    value: number;
  }[];
}

const STATUS_COLORS: Record<string, string> = {
  'Active': '#2563eb',     // blue-600
  'Completed': '#059669',  // emerald-600
  'Planned': '#d97706',    // amber-600
  'On Hold': '#ea580c',    // orange-600
  'Cancelled': '#dc2626',  // red-600
};

const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
  value,
}: any) => {
  if (percent < 0.05) return null;

  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={13}
      fontWeight={600}
    >
      {value}
    </text>
  );
};

export default function ProjectStatusChart({ data }: ProjectStatusChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={renderCustomizedLabel}
          outerRadius={105}
          innerRadius={50}
          fill="#2563eb"
          dataKey="value"
          paddingAngle={3}
          strokeWidth={2}
          stroke="#fff"
        >
          {data.map((entry) => (
            <Cell key={`cell-${entry.name}`} fill={STATUS_COLORS[entry.name] || '#6b7280'} />
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
          formatter={(value: number, name: string) => [`${value} project${value !== 1 ? 's' : ''}`, name]}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          iconType="circle"
          iconSize={8}
          formatter={(value) => <span style={{ color: '#374151', fontSize: '12px' }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
