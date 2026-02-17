import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface UtilizationChartProps {
  data: {
    month: string;
    available: number;
    utilized: number;
    utilization: number;
  }[];
}

export default function UtilizationChart({ data }: UtilizationChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorUtilized" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25}/>
            <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02}/>
          </linearGradient>
          <linearGradient id="colorAvailable" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0d9488" stopOpacity={0.18}/>
            <stop offset="95%" stopColor="#0d9488" stopOpacity={0.02}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
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
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
            fontSize: '13px',
          }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
        />
        <Area
          type="monotone"
          dataKey="utilized"
          stroke="#2563eb"
          strokeWidth={2.5}
          fillOpacity={1}
          fill="url(#colorUtilized)"
          name="Utilized Hours (Booked + Reserved)"
          dot={{ r: 3, fill: '#2563eb', strokeWidth: 0 }}
          activeDot={{ r: 5, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }}
        />
        <Area
          type="monotone"
          dataKey="available"
          stroke="#0d9488"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorAvailable)"
          name="Available Hours"
          dot={{ r: 3, fill: '#0d9488', strokeWidth: 0 }}
          activeDot={{ r: 5, fill: '#0d9488', strokeWidth: 2, stroke: '#fff' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
