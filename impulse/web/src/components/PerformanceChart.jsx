import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';

const COLORS = [
  'rgba(59, 130, 246, 0.78)',
  'rgba(16, 185, 129, 0.78)',
  'rgba(245, 158, 11, 0.78)',
  'rgba(236, 72, 153, 0.78)',
  'rgba(139, 92, 246, 0.78)',
  'rgba(14, 165, 233, 0.78)',
  'rgba(34, 197, 94, 0.78)',
  'rgba(251, 146, 60, 0.78)',
  'rgba(244, 63, 94, 0.78)',
  'rgba(168, 85, 247, 0.78)',
  'rgba(20, 184, 166, 0.78)',
  'rgba(99, 102, 241, 0.78)',
];

function hashString(value) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function rotatePalette(palette, seed) {
  if (!palette.length) return palette;

  const offset = hashString(seed) % palette.length;
  return [...palette.slice(offset), ...palette.slice(0, offset)];
}

function ActiveBar({ x, y, width, height, fill }) {
  if (x == null || y == null || width == null || height == null) {
    return null;
  }

  const inset = 2;

  return (
    <rect
      x={x - inset}
      y={y - inset}
      width={width + inset * 2}
      height={height + inset * 2}
      rx={12}
      ry={12}
      fill={fill}
      fillOpacity={1}
    />
  );
}

function ChartHoverCard({ active, payload, label, title, isDark }) {
  if (!active || !payload?.length) {
    return null;
  }

  const item = payload[0];
  const itemLabel = item?.name || item?.dataKey || title;
  const color = item?.color || item?.stroke || item?.fill || COLORS[0];
  const background = isDark ? 'rgba(8, 8, 10, 0.72)' : 'rgba(255, 255, 255, 0.72)';
  const border = isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.12)';

  return (
    <div
      className="min-w-[132px] rounded-[16px] border px-2.5 py-2 shadow-lg backdrop-blur-xl"
      style={{
        backgroundColor: background,
        borderColor: border,
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10"
          style={{ backgroundColor: color }}
        />
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/80">
          {title}
        </span>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-3">
        <span className="text-xs font-normal text-foreground/75">
          {label || itemLabel}
        </span>
        <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
          {typeof item?.value === 'number' ? item.value.toLocaleString() : item?.value}
        </span>
      </div>
    </div>
  );
}

function PerformanceChart({ type, data, title, dataKey, xKey, yKey }) {
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const palette = React.useMemo(() => rotatePalette(COLORS, `${title}-${dataKey}-${type}`), [title, dataKey, type]);

  const chartConfig = {
    value: {
      label: title,
      color: palette[0],
    },
  };

  const renderChart = () => {
    switch (type) {
      case 'line':
        return (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
              <XAxis dataKey={xKey} stroke={isDark ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.72)'} style={{ fontSize: '12px', fontWeight: 500 }} />
              <YAxis stroke={isDark ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.72)'} style={{ fontSize: '12px', fontWeight: 500 }} />
              <ChartTooltip cursor={false} content={<ChartHoverCard title={title} isDark={isDark} />} />
              <Legend wrapperStyle={{ fontWeight: 500 }} />
              <Line type="monotone" dataKey={dataKey} stroke={palette[0]} strokeWidth={3} dot={{ fill: palette[0], r: 4, strokeWidth: 2, stroke: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.65)' }} activeDot={{ r: 7 }} />
            </LineChart>
          </ChartContainer>
        );

      case 'bar':
        return (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
              <XAxis dataKey={xKey} stroke={isDark ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.72)'} style={{ fontSize: '12px', fontWeight: 500 }} />
              <YAxis stroke={isDark ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.72)'} style={{ fontSize: '12px', fontWeight: 500 }} />
              <ChartTooltip cursor={false} content={<ChartHoverCard title={title} isDark={isDark} />} />
              <Legend wrapperStyle={{ fontWeight: 500 }} />
              <Bar dataKey={dataKey} radius={[10, 10, 0, 0]} activeBar={<ActiveBar />}>
                {data.map((entry, index) => (
                  <Cell
                    key={`bar-cell-${index}`}
                    fill={palette[index % palette.length]}
                    fillOpacity={0.78}
                    stroke={palette[index % palette.length]}
                    strokeOpacity={0.16}
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        );

      case 'pie':
        return (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill={palette[0]}
                dataKey={dataKey}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={palette[index % palette.length]} fillOpacity={0.78} stroke={isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.5)'} strokeWidth={1} />
                ))}
              </Pie>
              <ChartTooltip cursor={false} content={<ChartHoverCard title={title} isDark={isDark} />} />
            </PieChart>
          </ChartContainer>
        );

      default:
        return null;
    }
  };

  return (
    <Card className="border-border rounded-3xl overflow-hidden max-md:min-w-0">
      <CardHeader>
        <CardTitle className="text-lg font-black uppercase tracking-tight">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {renderChart()}
      </CardContent>
    </Card>
  );
}

export default PerformanceChart;