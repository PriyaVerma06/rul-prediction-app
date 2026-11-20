import React from 'react';
import { ResponsiveContainer, LineChart, Line } from 'recharts';

interface MiniSparklineStripProps {
  readings: number[][];
  featureNames: string[];
}

export const MiniSparklineStrip: React.FC<MiniSparklineStripProps> = ({
  readings,
  featureNames,
}) => {
  if (readings.length === 0) return null;

  // Pick up to 4 sensors to display in the mini preview strip
  const previewChannels = ['sensor_2', 'sensor_4', 'sensor_11', 'sensor_12'].filter((c) =>
    featureNames.includes(c)
  ).slice(0, 4);

  const channelsToUse = previewChannels.length > 0 ? previewChannels : featureNames.slice(0, 3);

  const data = readings.map((row, idx) => {
    const pt: Record<string, number> = { cycle: idx + 1 };
    channelsToUse.forEach((ch) => {
      const colIdx = featureNames.indexOf(ch);
      if (colIdx >= 0 && colIdx < row.length) {
        pt[ch] = row[colIdx];
      }
    });
    return pt;
  });

  const colors = ['#0284c7', '#6366f1', '#10b981', '#f59e0b'];

  return (
    <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
        <span>Sensor Preview Strip (30 cycles)</span>
        <div className="flex items-center gap-2 font-mono text-[10px]">
          {channelsToUse.map((ch, idx) => (
            <span key={ch} className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors[idx % colors.length] }} />
              {ch}
            </span>
          ))}
        </div>
      </div>

      <div className="h-10 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            {channelsToUse.map((ch, idx) => (
              <Line
                key={ch}
                type="monotone"
                dataKey={ch}
                stroke={colors[idx % colors.length]}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

