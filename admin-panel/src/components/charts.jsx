import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { useApp } from '../context/AppContext.jsx';
import { fmtShortDate } from '../lib/format.js';

export const CHART_COLORS = ['#6366f1', '#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#14b8a6'];

function useAxis() {
  const { theme } = useApp();
  const dark = theme === 'dark';
  return {
    grid: dark ? '#232b3e' : '#e9edf5',
    text: dark ? '#64708a' : '#94a3b8',
    tooltipBg: dark ? '#1a2032' : '#ffffff',
    tooltipBorder: dark ? '#2f3a54' : '#e4e8f0',
    tooltipText: dark ? '#e8ecf5' : '#0f172a',
  };
}

function TT({ active, payload, label, ax }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: ax.tooltipBg, border: `1px solid ${ax.tooltipBorder}`,
      borderRadius: 10, padding: '10px 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
      fontSize: 12.5,
    }}>
      <div style={{ color: ax.tooltipText, fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, color: ax.tooltipText, marginTop: 3 }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, background: p.color || p.fill }} />
          <span style={{ color: ax.text }}>{p.name}:</span>
          <strong>{Number(p.value).toLocaleString('en-US')}</strong>
        </div>
      ))}
    </div>
  );
}

export function TrendArea({ data, series, height = 300 }) {
  const ax = useAxis();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color || CHART_COLORS[i]} stopOpacity={0.35} />
              <stop offset="100%" stopColor={s.color || CHART_COLORS[i]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={ax.grid} vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtShortDate} tick={{ fill: ax.text, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: ax.text, fontSize: 11 }} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
        <Tooltip content={(p) => <TT {...p} ax={ax} />} labelFormatter={fmtShortDate} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />}
        {series.map((s, i) => (
          <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color || CHART_COLORS[i]}
            strokeWidth={2.5} fill={`url(#g-${s.key})`} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BarsChart({ data, series, height = 300 }) {
  const ax = useAxis();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={ax.grid} vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtShortDate} tick={{ fill: ax.text, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: ax.text, fontSize: 11 }} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
        <Tooltip content={(p) => <TT {...p} ax={ax} />} labelFormatter={fmtShortDate} cursor={{ fill: ax.grid, opacity: 0.4 }} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color || CHART_COLORS[i]} radius={[5, 5, 0, 0]} maxBarSize={26} stackId={s.stack} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ data, height = 240 }) {
  const ax = useAxis();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="85%" paddingAngle={2} stroke="none">
          {data.map((d, i) => <Cell key={i} fill={d.color || CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Pie>
        <Tooltip content={(p) => <TT {...p} ax={ax} />} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
      </PieChart>
    </ResponsiveContainer>
  );
}
