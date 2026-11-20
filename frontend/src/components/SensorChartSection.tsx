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
  TrendingUp,
  TrendingDown,
  Minus,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Search,
  Sparkles,
  Maximize2,
  LayoutGrid,
  Info,
} from 'lucide-react';

interface SensorChartSectionProps {
  readings: number[][];
  featureNames: string[];
  windowSize: number;
}

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

export const SensorChartSection: React.FC<SensorChartSectionProps> = ({
  readings,
  featureNames,
  windowSize,
}) => {
  const [viewScale, setViewScale] = useState<'normalized' | 'raw'>('normalized');
  const [layoutMode, setLayoutMode] = useState<'grid' | 'combined'>('grid'); // Default is Small Multiples Grid!
  const [isCustomizeOpen, setIsCustomizeOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isConstantRowExpanded, setIsConstantRowExpanded] = useState<boolean>(false);

  // Top "most informative" C-MAPSS sensors
  const mostInformativeSensors = useMemo(() => {
    const candidates = [
      'sensor_2', 'sensor_3', 'sensor_4', 'sensor_7',
      'sensor_11', 'sensor_12', 'sensor_15', 'sensor_17',
      'sensor_20', 'sensor_21',
    ];
    const present = candidates.filter((s) => featureNames.includes(s));
    return present.length > 0 ? present : featureNames.slice(0, 8);
  }, [featureNames]);

  const [selectedSensors, setSelectedSensors] = useState<string[]>(mostInformativeSensors);

  // Stats for each sensor (min, max, constant check, trend)
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

      // Trend from first 5 vs last 5 cycles
      const firstChunk = values.slice(0, Math.min(5, values.length));
      const lastChunk = values.slice(Math.max(0, values.length - 5));

      const firstAvg = firstChunk.reduce((a, b) => a + b, 0) / (firstChunk.length || 1);
      const lastAvg = lastChunk.reduce((a, b) => a + b, 0) / (lastChunk.length || 1);

      const delta = lastAvg - firstAvg;
      const relativeChange = Math.abs(firstAvg) > 1e-5 ? delta / Math.abs(firstAvg) : delta;

      let trend: 'rising' | 'falling' | 'stable' = 'stable';
      if (!isConstant) {
        if (relativeChange > 0.012) trend = 'rising';
        else if (relativeChange < -0.012) trend = 'falling';
      }

      stats[feat] = { min, max, isConstant, trend, latest };
    });

    return stats;
  }, [readings, featureNames]);

  // Separate active sensors into varying vs constant sensors
  const { activeVaryingSensors, activeConstantSensors } = useMemo(() => {
    const varying: string[] = [];
    const constant: string[] = [];

    selectedSensors.forEach((s) => {
      if (sensorStats[s]?.isConstant) {
        constant.push(s);
      } else {
        varying.push(s);
      }
    });

    return { activeVaryingSensors: varying, activeConstantSensors: constant };
  }, [selectedSensors, sensorStats]);

  // Transformed chart data
  const chartData = useMemo(() => {
    if (!readings || readings.length === 0) return [];

    return readings.map((row, rIdx) => {
      const pt: Record<string, number> = { cycle: rIdx + 1 };
      featureNames.forEach((feat, colIdx) => {
        if (colIdx < row.length) {
          const rawVal = row[colIdx];
          pt[`${feat}_raw`] = rawVal;

          const st = sensorStats[feat];
          if (!st || st.isConstant || Math.abs(st.max - st.min) < 1e-5) {
            pt[feat] = 0.5;
          } else {
            pt[feat] = (rawVal - st.min) / (st.max - st.min);
          }
        }
      });
      return pt;
    });
  }, [readings, featureNames, sensorStats]);

  // Grouped feature categories for the customize popover
  const { settingFeatures, sensorFeatures } = useMemo(() => {
    const filtered = featureNames.filter((f) =>
      f.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return {
      settingFeatures: filtered.filter((f) => f.startsWith('setting')),
      sensorFeatures: filtered.filter((f) => !f.startsWith('setting')),
    };
  }, [featureNames, searchQuery]);

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
    <div className="space-y-6 pt-4">
      {/* Section Header with Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            What the sensors show
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Trajectories across the {windowSize}-cycle window
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Normalized vs Raw Switch */}
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl font-semibold text-slate-600 dark:text-slate-300">
            <button
              type="button"
              onClick={() => setViewScale('normalized')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewScale === 'normalized'
                  ? 'bg-white dark:bg-slate-700 text-slate-950 dark:text-white shadow-2xs'
                  : 'hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Normalized (0-1)
            </button>
            <button
              type="button"
              onClick={() => setViewScale('raw')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewScale === 'raw'
                  ? 'bg-white dark:bg-slate-700 text-slate-950 dark:text-white shadow-2xs'
                  : 'hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Raw values
            </button>
          </div>

          {/* Layout Mode Button (Combined vs Grid) */}
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl font-semibold text-slate-600 dark:text-slate-300">
            <button
              type="button"
              onClick={() => setLayoutMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${
                layoutMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-slate-950 dark:text-white shadow-2xs'
                  : 'hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Small multiples grid"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('combined')}
              className={`p-1.5 rounded-lg transition-all ${
                layoutMode === 'combined'
                  ? 'bg-white dark:bg-slate-700 text-slate-950 dark:text-white shadow-2xs'
                  : 'hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Combined multi-line graph"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

          {/* Customise Popover Toggle */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsCustomizeOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-700 dark:text-slate-200 shadow-2xs transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>Customise</span>
            </button>

            {/* Customise Popover Dropdown */}
            {isCustomizeOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 p-4 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-40 space-y-3.5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
                  <span className="font-bold text-xs text-slate-900 dark:text-white">
                    Select Channels ({selectedSensors.length} active)
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setSelectedSensors(mostInformativeSensors)}
                      className="text-sky-600 dark:text-sky-400 hover:underline font-medium inline-flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      Most informative
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => setSelectedSensors(featureNames)}
                      className="hover:underline text-slate-500"
                    >
                      All
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => setSelectedSensors([featureNames[0] || 'setting_1'])}
                      className="hover:underline text-slate-500"
                    >
                      None
                    </button>
                  </div>
                </div>

                {/* Filter Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search channels..."
                    className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                {/* Grouped Chips */}
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {settingFeatures.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Operating Settings</div>
                      <div className="flex flex-wrap gap-1">
                        {settingFeatures.map((f) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => toggleSensor(f)}
                            className={`px-2 py-0.5 rounded-md text-[11px] font-mono transition-colors ${
                              selectedSensors.includes(f)
                                ? 'bg-sky-600 text-white font-semibold'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                            }`}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {sensorFeatures.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Sensors</div>
                      <div className="flex flex-wrap gap-1">
                        {sensorFeatures.map((f) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => toggleSensor(f)}
                            className={`px-2 py-0.5 rounded-md text-[11px] font-mono transition-colors ${
                              selectedSensors.includes(f)
                                ? 'bg-indigo-600 text-white font-semibold'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                            }`}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-700 text-right">
                  <button
                    type="button"
                    onClick={() => setIsCustomizeOpen(false)}
                    className="px-3 py-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-xs font-semibold"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* VIEW 1: SMALL MULTIPLES GRID (DEFAULT) */}
      {layoutMode === 'grid' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {activeVaryingSensors.map((sensor, idx) => {
              const st = sensorStats[sensor];
              const color = SENSOR_COLORS[idx % SENSOR_COLORS.length];

              return (
                <div
                  key={sensor}
                  className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-2 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                        {sensor}
                      </span>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        Latest: <span className="font-semibold text-slate-700 dark:text-slate-200">{st?.latest.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Trend Badge */}
                    {st?.trend === 'rising' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-900">
                        <TrendingUp className="w-3 h-3" />
                        rising
                      </span>
                    ) : st?.trend === 'falling' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 rounded-full border border-sky-200 dark:border-sky-900">
                        <TrendingDown className="w-3 h-3" />
                        falling
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        <Minus className="w-3 h-3" />
                        stable
                      </span>
                    )}
                  </div>

                  {/* Sparkline Area */}
                  <div className="h-24 w-full pt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 2, right: 4, left: -25, bottom: 0 }}>
                        <defs>
                          <linearGradient id={`grad-grid-${sensor}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.25} />
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
                          fill={`url(#grad-grid-${sensor})`}
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Collapsible "Unchanged Sensors" row */}
          {activeConstantSensors.length > 0 && (
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-4 transition-colors">
              <button
                type="button"
                onClick={() => setIsConstantRowExpanded((prev) => !prev)}
                className="w-full flex items-center justify-between text-left text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  <span>Unchanged sensors ({activeConstantSensors.length} channels with zero variation)</span>
                </div>
                <div className="flex items-center gap-1 text-slate-400">
                  <span>{isConstantRowExpanded ? 'Hide' : 'Show details'}</span>
                  {isConstantRowExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </div>
              </button>

              {isConstantRowExpanded && (
                <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800 flex flex-wrap gap-2 text-xs">
                  {activeConstantSensors.map((cSensor) => (
                    <div
                      key={cSensor}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-600 dark:text-slate-300 flex items-center gap-1.5"
                    >
                      <span className="font-bold">{cSensor}</span>
                      <span className="text-[10px] text-slate-400">
                        = {sensorStats[cSensor]?.latest.toFixed(2)} (constant)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: COMBINED MULTI-LINE CHART */}
      {layoutMode === 'combined' && (
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
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
                    value: 'Cycle',
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
                    value: viewScale === 'normalized' ? 'Normalized (0 - 1)' : 'Value',
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
        </div>
      )}

      {/* Explanatory Note */}
      <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 pt-1">
        <Info className="w-3.5 h-3.5 shrink-0" />
        <span>
          {viewScale === 'normalized'
            ? 'Normalized view scales each sensor from 0 to 1 over the window so relative wear curves can be compared regardless of unit differences.'
            : 'Raw view reflects actual physical engineering values.'}
        </span>
      </div>
    </div>
  );
};

