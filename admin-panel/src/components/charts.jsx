import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { useApp } from '../context/AppContext.jsx';
import { fmtShortDate } from '../lib/format.js';

export const CHART_COLORS = ['#8b5cf6', '#f97316', '#06b6d4', '#10b981', '#fbbf24', '#d946ef'];

function useAxis() {
  const { theme } = useApp();
  const dark = theme === 'dark';
  return {
    grid: dark ? 'rgba(255,255,255,0.04)' : '#e2e8f0',
    text: dark ? '#64748b' : '#94a3b8',
    tooltipBg: dark ? '#0d1122' : '#ffffff',
    tooltipBorder: dark ? 'rgba(255,255,255,0.1)' : '#cbd5e1',
    tooltipText: dark ? '#f8fafc' : '#0f172a',
  };
}

function TT({ active, payload, label, ax }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: ax.tooltipBg, border: `1px solid ${ax.tooltipBorder}`,
      borderRadius: 12, padding: '10px 14px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
      fontSize: 12.5,
    }}>
      <div style={{ color: ax.tooltipText, fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, color: ax.tooltipText, marginTop: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || p.fill }} />
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
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color || CHART_COLORS[i]} stopOpacity={0.3} />
              <stop offset="100%" stopColor={s.color || CHART_COLORS[i]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={ax.grid} vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtShortDate} tick={{ fill: ax.text, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: ax.text, fontSize: 11 }} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
        <Tooltip content={(p) => <TT {...p} ax={ax} />} labelFormatter={fmtShortDate} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} iconType="circle" iconSize={6} />}
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
      <BarChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={ax.grid} vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtShortDate} tick={{ fill: ax.text, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: ax.text, fontSize: 11 }} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
        <Tooltip content={(p) => <TT {...p} ax={ax} />} labelFormatter={fmtShortDate} cursor={{ fill: ax.grid, opacity: 0.2 }} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} iconType="circle" iconSize={6} />}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color || CHART_COLORS[i]} radius={[4, 4, 0, 0]} maxBarSize={22} stackId={s.stack} />
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
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={3} stroke="none">
          {data.map((d, i) => <Cell key={i} fill={d.color || CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Pie>
        <Tooltip content={(p) => <TT {...p} ax={ax} />} />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} iconType="circle" iconSize={6} />
      </PieChart>
    </ResponsiveContainer>
  );
}
