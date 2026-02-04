import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface UtilizationChartProps {
  data: {
    month: string;
    available: number;
    booked: number;
    utilization: number;
  }[];
}

export default function UtilizationChart({ data }: UtilizationChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorBooked" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#9ca3af" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#9ca3af" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorAvailable" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis 
          dataKey="month" 
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
        />
        <YAxis 
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'white', 
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
          }}
        />
        <Legend />
        <Area 
          type="monotone" 
          dataKey="booked" 
          stroke="#9ca3af" 
          fillOpacity={1} 
          fill="url(#colorBooked)"
          name="Booked Hours"
        />
        <Area 
          type="monotone" 
          dataKey="available" 
          stroke="#10b981" 
          fillOpacity={1} 
          fill="url(#colorAvailable)"
          name="Available Hours"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
