import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { LineChart as ChartIcon, SlidersHorizontal, Info } from 'lucide-react';

interface SensorChartProps {
  readings: number[][];
  featureNames: string[];
  windowSize: number;
}

// Visual color palette for distinct sensor lines
const LINE_COLORS = [
  '#0284c7', // Sky
  '#4f46e5', // Indigo
  '#059669', // Emerald
  '#d97706', // Amber
  '#dc2626', // Red
  '#9333ea', // Purple
  '#0891b2', // Cyan
  '#ea580c', // Orange
  '#4b5563', // Slate
];

export const SensorChart: React.FC<SensorChartProps> = ({
  readings,
  featureNames,
  windowSize,
}) => {
  // Common informative turbofan degradation sensors (LPT exit temp, HPC outlet pressure, etc.)
  const defaultSensors = useMemo(() => {
    const candidates = ['sensor_2', 'sensor_3', 'sensor_4', 'sensor_7', 'sensor_11', 'sensor_12'];
    const filtered = candidates.filter((s) => featureNames.includes(s));
    return filtered.length > 0 ? filtered : featureNames.slice(0, 4);
  }, [featureNames]);

  const [selectedSensors, setSelectedSensors] = useState<string[]>(defaultSensors);

  // Transform readings into Recharts series format: [{ cycle: 1, sensor_2: 642.5, ... }]
  const chartData = useMemo(() => {
    if (!readings || readings.length === 0) return [];

    return readings.map((cycleRow, idx) => {
      const dataPoint: Record<string, number> = {
        cycle: idx + 1,
      };

      featureNames.forEach((name, featIdx) => {
        if (featIdx < cycleRow.length) {
          dataPoint[name] = cycleRow[featIdx];
        }
      });

      return dataPoint;
    });
  }, [readings, featureNames]);

  // Toggle selection of a sensor
  const toggleSensor = (sensor: string) => {
    if (selectedSensors.includes(sensor)) {
      if (selectedSensors.length > 1) {
        setSelectedSensors(selectedSensors.filter((s) => s !== sensor));
      }
    } else {
      setSelectedSensors([...selectedSensors, sensor]);
    }
  };

  const handleSelectAllSensors = () => {
    // Select first 8 sensors to prevent over-cluttering
    setSelectedSensors(featureNames.slice(0, 8));
  };

  const handleResetSensors = () => {
    setSelectedSensors(defaultSensors);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-200 bg-slate-50/70 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <ChartIcon className="w-5 h-5 text-indigo-600" />
          <h2 className="font-semibold text-slate-800 text-sm sm:text-base">
            Sensor Trajectory Trends
          </h2>
          <span className="text-xs text-slate-500">
            ({windowSize} operational cycles)
          </span>
        </div>

        {/* Quick action controls */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={handleResetSensors}
            className="text-slate-500 hover:text-slate-800 px-2 py-1 rounded hover:bg-slate-200/60 transition-colors"
          >
            Reset Default Sensors
          </button>
          <span className="text-slate-300">|</span>
          <button
            onClick={handleSelectAllSensors}
            className="text-indigo-600 hover:text-indigo-700 font-medium px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
          >
            Top 8 Sensors
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4">
        {/* Sensor selector pills */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1 font-medium text-slate-700">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              Toggle Sensor Channels ({selectedSensors.length} active):
            </span>
            <span className="text-[11px] text-slate-400">
              Click any channel to display / hide on the graph
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-100">
            {featureNames.map((feat) => {
              const isSelected = selectedSensors.includes(feat);
              const colorIdx = selectedSensors.indexOf(feat);
              const strokeColor = colorIdx >= 0 ? LINE_COLORS[colorIdx % LINE_COLORS.length] : undefined;

              return (
                <button
                  key={feat}
                  onClick={() => toggleSensor(feat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-white text-slate-800 shadow-xs border border-slate-300'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/50'
                  }`}
                >
                  {isSelected && (
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: strokeColor }}
                    />
                  )}
                  <span>{feat}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Recharts Line Graph */}
        <div className="h-72 w-full pt-2">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              No cycle data available to plot.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="cycle"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={{ stroke: '#cbd5e1' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  label={{
                    value: 'Operating Cycle Sequence',
                    position: 'insideBottom',
                    offset: -5,
                    fontSize: 11,
                    fill: '#94a3b8',
                  }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={{ stroke: '#cbd5e1' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '0.75rem',
                    color: '#f8fafc',
                    fontSize: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  }}
                  itemStyle={{ padding: '2px 0' }}
                  formatter={(val: number) => [val.toFixed(3), '']}
                  labelFormatter={(cycle) => `Cycle #${cycle}`}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                />
                {selectedSensors.map((sensor, sIdx) => (
                  <Line
                    key={sensor}
                    type="monotone"
                    dataKey={sensor}
                    name={sensor}
                    stroke={LINE_COLORS[sIdx % LINE_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Tip footnote */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-1 border-t border-slate-100">
          <Info className="w-3.5 h-3.5 text-slate-400" />
          <span>
            Displays raw sensor trajectory. Note that during inference, features are normalized via the pre-fitted StandardScaler.
          </span>
        </div>
      </div>
    </div>
  );
};
