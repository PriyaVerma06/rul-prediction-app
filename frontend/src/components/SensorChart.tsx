import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Brush,
} from 'recharts';
import {
  LineChart as ChartIcon,
  LayoutGrid,
  Maximize2,
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  Sparkles,
  SlidersHorizontal,
  Info,
} from 'lucide-react';

interface SensorChartProps {
  readings: number[][];
  featureNames: string[];
  windowSize: number;
}

// 12 distinct colors for sensor channels
const SENSOR_COLORS = [
  '#0284c7', // Sky
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#84cc16', // Lime
  '#64748b', // Slate
];

export const SensorChart: React.FC<SensorChartProps> = ({
  readings,
  featureNames,
  windowSize,
}) => {
  const [viewScale, setViewScale] = useState<'normalized' | 'raw'>('normalized');
  const [layoutMode, setLayoutMode] = useState<'combined' | 'grid'>('combined');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Default "most informative" C-MAPSS sensors
  const mostInformativeSensors = useMemo(() => {
    const candidates = [
      'sensor_2', 'sensor_3', 'sensor_4', 'sensor_7',
      'sensor_11', 'sensor_12', 'sensor_15', 'sensor_17',
      'sensor_20', 'sensor_21',
    ];
    const present = candidates.filter((s) => featureNames.includes(s));
    return present.length > 0 ? present : featureNames.slice(0, 6);
  }, [featureNames]);

  const [selectedSensors, setSelectedSensors] = useState<string[]>(mostInformativeSensors);

  // Stats for each sensor across the window (min, max, constant check, trend)
  const sensorStats = useMemo(() => {
    const stats: Record<
      string,
      { min: number; max: number; isConstant: boolean; trend: 'rising' | 'falling' | 'stable'; latest: number }
    > = {};

    featureNames.forEach((feat, colIdx) => {
      const values = readings.map((row) => (colIdx < row.length ? row[colIdx] : 0));
      if (values.length === 0) {
        stats[feat] = { min: 0, max: 0, isConstant: true, trend: 'stable', latest: 0 };
        return;
      }

      const min = Math.min(...values);
      const max = Math.max(...values);
      const isConstant = Math.abs(max - min) < 1e-5;
      const latest = values[values.length - 1];

      // Calculate trend from first 5 vs last 5 cycles
      const firstChunk = values.slice(0, Math.min(5, values.length));
      const lastChunk = values.slice(Math.max(0, values.length - 5));

      const firstAvg = firstChunk.reduce((a, b) => a + b, 0) / (firstChunk.length || 1);
      const lastAvg = lastChunk.reduce((a, b) => a + b, 0) / (lastChunk.length || 1);

      const delta = lastAvg - firstAvg;
      const relativeChange = Math.abs(firstAvg) > 1e-5 ? delta / Math.abs(firstAvg) : delta;

      let trend: 'rising' | 'falling' | 'stable' = 'stable';
      if (!isConstant) {
        if (relativeChange > 0.015) trend = 'rising';
        else if (relativeChange < -0.015) trend = 'falling';
      }

      stats[feat] = { min, max, isConstant, trend, latest };
    });

    return stats;
  }, [readings, featureNames]);

  // Transform data for Recharts (both normalized and raw)
  const chartData = useMemo(() => {
    if (!readings || readings.length === 0) return [];

    return readings.map((row, rIdx) => {
      const point: Record<string, number> = { cycle: rIdx + 1 };

      featureNames.forEach((feat, colIdx) => {
        if (colIdx < row.length) {
          const rawVal = row[colIdx];
          point[`${feat}_raw`] = rawVal;

          const st = sensorStats[feat];
          if (!st || st.isConstant || Math.abs(st.max - st.min) < 1e-5) {
            point[feat] = 0.5; // mid-line for constant
          } else {
            point[feat] = (rawVal - st.min) / (st.max - st.min);
          }
        }
      });

      return point;
    });
  }, [readings, featureNames, sensorStats]);

  // Grouped sensors: Operating settings vs Sensors
  const { settingFeatures, sensorFeatures } = useMemo(() => {
    const filtered = featureNames.filter((f) =>
      f.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const settings = filtered.filter((f) => f.startsWith('setting'));
    const sensors = filtered.filter((f) => !f.startsWith('setting'));
    return { settingFeatures: settings, sensorFeatures: sensors };
  }, [featureNames, searchQuery]);

  // Toggle selection
  const toggleSensor = (sensor: string) => {
    if (selectedSensors.includes(sensor)) {
      if (selectedSensors.length > 1) {
        setSelectedSensors(selectedSensors.filter((s) => s !== sensor));
      }
    } else {
      setSelectedSensors([...selectedSensors, sensor]);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
      {/* Chart Header Bar */}
      <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <ChartIcon className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white text-base">
              Sensor Trajectory Trends
            </h2>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {windowSize} cycles · {selectedSensors.length} active channels
            </div>
          </div>
        </div>

        {/* View Controls: Scale Toggle & Layout Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Normalized vs Raw Toggle */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300">
            <button
              type="button"
              onClick={() => setViewScale('normalized')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                viewScale === 'normalized'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Scale all sensors 0-1 to compare trends regardless of unit magnitude"
            >
              Normalized (0-1)
            </button>
            <button
              type="button"
              onClick={() => setViewScale('raw')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                viewScale === 'raw'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Display actual raw physical measurements"
            >
              Raw values
            </button>
          </div>

          {/* Combined vs Small Multiples Toggle */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300">
            <button
              type="button"
              onClick={() => setLayoutMode('combined')}
              className={`p-1.5 rounded-lg transition-all ${
                layoutMode === 'combined'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
              title="Combined multi-line chart"
              aria-label="Combined multi-line chart view"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${
                layoutMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
              title="Small multiples grid view"
              aria-label="Small multiples grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-5">
        {/* Sensor Picker Accordion / Selector */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Select Sensor Channels
              </span>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => setSelectedSensors(mostInformativeSensors)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-medium hover:bg-indigo-100 transition-colors"
              >
                <Sparkles className="w-3 h-3 text-amber-500" />
                Most Informative
              </button>
              <button
                type="button"
                onClick={() => setSelectedSensors(featureNames)}
                className="px-2 py-0.5 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                All ({featureNames.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedSensors([featureNames[0] || 'setting_1'])}
                className="px-2 py-0.5 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                None
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter channels (e.g. sensor_2, setting_1)..."
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {/* Grouped Chips */}
          <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
            {settingFeatures.length > 0 && (
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider mb-1">
                  Operating Settings
                </div>
                <div className="flex flex-wrap gap-1">
                  {settingFeatures.map((feat) => {
                    const isSelected = selectedSensors.includes(feat);
                    const isConstant = sensorStats[feat]?.isConstant;
                    return (
                      <button
                        key={feat}
                        type="button"
                        onClick={() => toggleSensor(feat)}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-mono transition-all flex items-center gap-1 ${
                          isSelected
                            ? 'bg-sky-600 text-white shadow-2xs font-semibold'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>{feat}</span>
                        {isConstant && (
                          <span className="text-[9px] px-1 rounded bg-black/20 text-white font-sans">
                            constant
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {sensorFeatures.length > 0 && (
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider mb-1">
                  Sensors
                </div>
                <div className="flex flex-wrap gap-1">
                  {sensorFeatures.map((feat) => {
                    const isSelected = selectedSensors.includes(feat);
                    const isConstant = sensorStats[feat]?.isConstant;
                    return (
                      <button
                        key={feat}
                        type="button"
                        onClick={() => toggleSensor(feat)}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-mono transition-all flex items-center gap-1 ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-2xs font-semibold'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>{feat}</span>
                        {isConstant && (
                          <span className="text-[9px] px-1 rounded bg-black/20 text-white font-sans">
                            constant
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* VIEW 1: COMBINED MULTI-LINE CHART */}
        {layoutMode === 'combined' && (
          <div className="h-80 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                <XAxis
                  dataKey="cycle"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={{ stroke: '#cbd5e1' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  label={{
                    value: 'Operating Cycle',
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
                  domain={viewScale === 'normalized' ? [0, 1] : ['auto', 'auto']}
                  label={{
                    value: viewScale === 'normalized' ? 'Normalized (0 - 1)' : 'Raw Value',
                    angle: -90,
                    position: 'insideLeft',
                    fontSize: 10,
                    fill: '#94a3b8',
                    offset: 15,
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '0.75rem',
                    color: '#f8fafc',
                    fontSize: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
                  }}
                  formatter={(val: number, name: string) => {
                    const rawVal = chartData.find((p) => p[name] === val)?.[`${name}_raw`];
                    const displayVal = typeof rawVal === 'number' ? rawVal.toFixed(3) : val.toFixed(3);
                    return [displayVal, name];
                  }}
                  labelFormatter={(cycle) => `Cycle #${cycle}`}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                {selectedSensors.map((sensor, sIdx) => {
                  const dataKey = viewScale === 'normalized' ? sensor : `${sensor}_raw`;
                  const color = SENSOR_COLORS[sIdx % SENSOR_COLORS.length];
                  return (
                    <Line
                      key={sensor}
                      type="monotone"
                      dataKey={dataKey}
                      name={sensor}
                      stroke={color}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  );
                })}
                <Brush dataKey="cycle" height={22} stroke="#94a3b8" fill="#f8fafc" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* VIEW 2: SMALL MULTIPLES GRID */}
        {layoutMode === 'grid' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {selectedSensors.map((sensor, idx) => {
              const st = sensorStats[sensor];
              const color = SENSOR_COLORS[idx % SENSOR_COLORS.length];

              return (
                <div
                  key={sensor}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2 flex flex-col justify-between"
                >
                  {/* Card Header: Sensor Title + Latest Value + Trend Arrow */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-bold font-mono text-slate-800 dark:text-slate-100">
                        {sensor}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        Latest: <span className="font-semibold text-slate-700 dark:text-slate-200">{st?.latest.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Trend / Constant badge */}
                    {st?.isConstant ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        Constant
                      </span>
                    ) : st?.trend === 'rising' ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 inline-flex items-center gap-0.5">
                        <TrendingUp className="w-3 h-3" />
                        Rising
                      </span>
                    ) : st?.trend === 'falling' ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 inline-flex items-center gap-0.5">
                        <TrendingDown className="w-3 h-3" />
                        Falling
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 inline-flex items-center gap-0.5">
                        <Minus className="w-3 h-3" />
                        Stable
                      </span>
                    )}
                  </div>

                  {/* Sparkline Area Chart */}
                  <div className="h-28 w-full pt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={chartData}
                        margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id={`grad-${sensor}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={color} stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 2" stroke="#e2e8f0" strokeOpacity={0.4} />
                        <XAxis dataKey="cycle" hide />
                        <YAxis domain={viewScale === 'normalized' ? [0, 1] : ['auto', 'auto']} tick={{ fontSize: 9 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            borderRadius: '0.5rem',
                            color: '#fff',
                            fontSize: '11px',
                          }}
                          formatter={(v: number) => {
                            const raw = chartData.find((p) => p[sensor] === v)?.[`${sensor}_raw`];
                            return [typeof raw === 'number' ? raw.toFixed(2) : v.toFixed(2), sensor];
                          }}
                          labelFormatter={(c) => `Cycle #${c}`}
                        />
                        <Area
                          type="monotone"
                          dataKey={viewScale === 'normalized' ? sensor : `${sensor}_raw`}
                          stroke={color}
                          strokeWidth={2}
                          fill={`url(#grad-${sensor})`}
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Informative Note */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Info className="w-3.5 h-3.5 shrink-0" />
          <span>
            {viewScale === 'normalized'
              ? 'Normalized view scales each sensor from 0 to 1 over the window so relative wear patterns can be compared across units.'
              : 'Raw view reflects sensor engineering physical units (PSI, °R, RPM, etc.).'}
          </span>
        </div>
      </div>
    </div>
  );
};
