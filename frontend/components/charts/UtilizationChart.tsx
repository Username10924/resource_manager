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
            <stop offset="5%" stopColor="#18181b" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#18181b" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorAvailable" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#71717a" stopOpacity={0.2}/>
            <stop offset="95%" stopColor="#71717a" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
        <XAxis
          dataKey="month"
          stroke="#a1a1aa"
          style={{ fontSize: '12px' }}
        />
        <YAxis
          stroke="#a1a1aa"
          style={{ fontSize: '12px' }}
        />
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
        <Area
          type="monotone"
          dataKey="utilized"
          stroke="#18181b"
          fillOpacity={1}
          fill="url(#colorUtilized)"
          name="Utilized Hours (Booked + Reserved)"
        />
        <Area
          type="monotone"
          dataKey="available"
          stroke="#71717a"
          fillOpacity={1}
          fill="url(#colorAvailable)"
          name="Available Hours"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
