import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
} from 'chart.js';
import { format } from 'date-fns';
import 'chartjs-adapter-date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

const LOCATIONS = {
  'Manila, PH': { minTemp: 24, maxTemp: 34 },
  'Digos City, PH': { minTemp: 23, maxTemp: 32 },
  'Cebu, PH': { minTemp: 25, maxTemp: 33 },
  'Davao, PH': { minTemp: 24, maxTemp: 32 }
};

const PESO_PER_KWH = 11.7882;
const MIN_TEMP_C = 16;
const MAX_TEMP_C = 30;
const MIN_TEMP_F = 60;
const MAX_TEMP_F = 86;
const ROOMS = ['bedroom', 'livingroom', 'masterbedroom', 'diningroom'];

function App() {
  const [insideTemp, setInsideTemp] = useState(24);
  const [outsideTemp, setOutsideTemp] = useState(30);
  const [desiredTemp, setDesiredTemp] = useState(24);
  const [mode, setMode] = useState('off');
  const [fan, setFan] = useState('auto');
  const [tempUnit, setTempUnit] = useState('C');
  const [location, setLocation] = useState('Digos City, PH');
  const [selectedRoom, setSelectedRoom] = useState('bedroom');
  const [roomData, setRoomData] = useState<{ [key: string]: { temperatureHistory: { time: Date; inside: number; outside: number; target: number }[]; energyUsage: number; costInPesos: number } }>({
    bedroom: { temperatureHistory: [], energyUsage: 0, costInPesos: 0 },
    livingroom: { temperatureHistory: [], energyUsage: 0, costInPesos: 0 },
    masterbedroom: { temperatureHistory: [], energyUsage: 0, costInPesos: 0 },
    diningroom: { temperatureHistory: [], energyUsage: 0, costInPesos: 0 }
  });
  const [scheduledTemps, setScheduledTemps] = useState<{ [key: string]: { [key: number]: number } }>({
    bedroom: {},
    livingroom: {},
    masterbedroom: {},
    diningroom: {}
  });
  const [isSchedulerModalOpen, setIsSchedulerModalOpen] = useState(false);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const airconSpecs = {
    model: 'Fujidenzo 1.0 HP WAR-100IGT',
    eer: 11.34,
    kjPerHour: 9072,
    wattage: 1080
  };

  useEffect(() => {
    const storedRoomData = localStorage.getItem('roomData');
    const storedScheduledTemps = localStorage.getItem('scheduledTemps');
    const storedDarkMode = localStorage.getItem('darkMode');
    const storedTempUnit = localStorage.getItem('tempUnit');
    const storedSelectedRoom = localStorage.getItem('selectedRoom');

    if (storedRoomData) {
      setRoomData(JSON.parse(storedRoomData));
    }
    if (storedScheduledTemps) {
      setScheduledTemps(JSON.parse(storedScheduledTemps));
    }
    if (storedDarkMode) {
      setDarkMode(JSON.parse(storedDarkMode));
    }
    if (storedTempUnit) {
      setTempUnit(storedTempUnit);
    }
    if (storedSelectedRoom) {
      setSelectedRoom(storedSelectedRoom);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('roomData', JSON.stringify(roomData));
  }, [roomData]);

  useEffect(() => {
    localStorage.setItem('scheduledTemps', JSON.stringify(scheduledTemps));
  }, [scheduledTemps]);

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('tempUnit', tempUnit);
  }, [tempUnit]);

  useEffect(() => {
    localStorage.setItem('selectedRoom', selectedRoom);
  }, [selectedRoom]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      updateTemperature();
      updateEnergyUsage();
      updateTemperatureHistory();
    }, 4000); // Update interval changed to 4000ms (4 seconds)

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, [insideTemp, desiredTemp, mode, location, scheduledTemps, selectedRoom]);

  useEffect(() => {
    const updatedRoomData = { ...roomData };
    updatedRoomData[selectedRoom].costInPesos = updatedRoomData[selectedRoom].energyUsage * PESO_PER_KWH;
    setRoomData(updatedRoomData);
  }, [roomData, selectedRoom]);

  const updateTemperature = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const scheduledTemp = scheduledTemps[selectedRoom][currentHour];
    const targetTemperature = scheduledTemp !== undefined ? scheduledTemp : desiredTemp;

    const coolingRate = mode === 'cool' ? 1 : 0.5;
    const heatingRate = mode === 'heat' ? 1 : 0.5;

    if (mode === 'cool' && insideTemp > targetTemperature) {
      setInsideTemp(prev => Math.max(prev - coolingRate, targetTemperature));
    } else if (mode === 'heat' && insideTemp < targetTemperature) {
      setInsideTemp(prev => Math.min(prev + heatingRate, targetTemperature));
    }

    const locationData = LOCATIONS[location as keyof typeof LOCATIONS];
    const randomTemp = Math.random() * (locationData.maxTemp - locationData.minTemp) + locationData.minTemp;
    setOutsideTemp(Math.round(randomTemp * 10) / 10);
  };

  const updateEnergyUsage = () => {
    if (mode !== 'off') {
      const hourlyUsage = airconSpecs.wattage / 1000;
      setRoomData(prev => ({
        ...prev,
        [selectedRoom]: {
          ...prev[selectedRoom],
          energyUsage: prev[selectedRoom].energyUsage + (hourlyUsage / 720)
        }
      }));
    }
  };

  const updateTemperatureHistory = () => {
    setRoomData(prev => ({
      ...prev,
      [selectedRoom]: {
        ...prev[selectedRoom],
        temperatureHistory: [
          ...prev[selectedRoom].temperatureHistory,
          { time: new Date(), inside: insideTemp, outside: outsideTemp, target: desiredTemp }
        ].slice(-72)
      }
    }));
  };

  const convertTemp = (temp: number, to: string) => {
    if (to === 'F') {
      return Math.round((temp * 9/5) + 32);
    }
    return Math.round((temp - 32) * 5/9);
  };

  const handleModeChange = (newMode: string) => {
    setMode(newMode);
    if (newMode === 'cool') {
      setDesiredTemp(tempUnit === 'C' ? 17 : convertTemp(17, 'F'));
    } else if (newMode === 'heat') {
      setDesiredTemp(tempUnit === 'C' ? 29 : convertTemp(29, 'F'));
    }
  };

  const openSchedulerModal = (hour: number) => {
    setSelectedHour(hour);
    setIsSchedulerModalOpen(true);
  };

  const setScheduledTemperature = (temp: number) => {
    if (selectedHour !== null) {
      setScheduledTemps(prev => ({
        ...prev,
        [selectedRoom]: {
          ...prev[selectedRoom],
          [selectedHour]: temp
        }
      }));
      setIsSchedulerModalOpen(false);
    }
  };

  const removeScheduledTemperature = (hour: number) => {
    const { [hour]: removed, ...rest } = scheduledTemps[selectedRoom];
    setScheduledTemps(prev => ({ ...prev, [selectedRoom]: rest }));
  };

  const chartData = useMemo(() => ({
    labels: roomData[selectedRoom].temperatureHistory.map(record => record.time),
    datasets: [
      {
        label: 'Inside Temperature',
        data: roomData[selectedRoom].temperatureHistory.map(record => tempUnit === 'C' ? record.inside : convertTemp(record.inside, 'F')),
        borderColor: darkMode ? '#bb86fc' : '#3b82f6',
        backgroundColor: darkMode ? 'rgba(187, 134, 252, 0.2)' : 'rgba(59, 130, 246, 0.2)',
        fill: false,
        tension: 0.4,
        pointRadius: 3,
        pointStyle: 'circle',
        borderWidth: 2
      },
      {
        label: 'Outside Temperature',
        data: roomData[selectedRoom].temperatureHistory.map(record => tempUnit === 'C' ? record.outside : convertTemp(record.outside, 'F')),
        borderColor: darkMode ? '#64748b' : '#4a5568',
        backgroundColor: darkMode ? 'rgba(100, 116, 139, 0.2)' : 'rgba(74, 85, 104, 0.2)',
        fill: false,
        tension: 0.4,
        pointRadius: 3,
        pointStyle: 'circle',
        borderWidth: 2
      },
      {
        label: 'Target Temperature',
        data: roomData[selectedRoom].temperatureHistory.map(record => tempUnit === 'C' ? record.target : convertTemp(record.target, 'F')),
        borderColor: darkMode ? '#03dac6' : '#10b981',
        backgroundColor: darkMode ? 'rgba(3, 218, 198, 0.2)' : 'rgba(16, 185, 129, 0.2)',
        borderDash: [5, 5],
        fill: false,
        tension: 0.4,
        pointRadius: 3,
        pointStyle: 'triangle',
        borderWidth: 2
      }
    ]
  }), [roomData, selectedRoom, tempUnit, darkMode]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'second',
          tooltipFormat: 'HH:mm:ss',
          displayFormats: {
            second: 'HH:mm:ss'
          }
        },
        grid: {
          color: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
        }
      },
      y: {
        beginAtZero: false,
        min: Math.min(
          Math.min(...roomData[selectedRoom].temperatureHistory.map(r => Math.min(r.inside, r.outside, r.target))) - 2 || 0,
          0
        ),
        max: Math.max(
          Math.max(...roomData[selectedRoom].temperatureHistory.map(r => Math.max(r.inside, r.outside, r.target))) + 2 || 0,
          0
        ),
        grid: {
          color: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
        },
        ticks: {
          callback: (value: number) => `${value}°${tempUnit}`
        }
      }
    },
    plugins: {
      legend: {
        display: true,
        labels: {
          color: darkMode ? '#ffffff' : '#000000',
          font: {
            family: 'Inter, system-ui, sans-serif'
          }
        }
      },
      tooltip: {
        enabled: true,
        mode: 'index' as const,
        intersect: false
      }
    },
    interaction: {
      mode: 'nearest' as const,
      intersect: false
    }
  }), [roomData, selectedRoom, tempUnit, darkMode]);

  const renderHourlySchedule = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    return (
      <div className="grid grid-cols-6 gap-2">
        {hours.map(hour => (
          <div
            key={hour}
            onClick={() => openSchedulerModal(hour)}
            className={`p-2 rounded cursor-pointer text-center ${
              scheduledTemps[selectedRoom][hour] !== undefined
                ? 'bg-blue-500 text-white'
                : darkMode
                  ? 'bg-gray-700 text-gray-300'
                  : 'bg-gray-200 text-gray-600'
            }`}
          >
            {format(new Date(0, 0, 0, hour), 'HH:mm')}
            {scheduledTemps[selectedRoom][hour] !== undefined && (
              <span className="block text-xs">
                {tempUnit === 'C'
                  ? scheduledTemps[selectedRoom][hour]
                  : convertTemp(scheduledTemps[selectedRoom][hour], 'F')}°{tempUnit}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderSchedulerModal = () => {
    if (!isSchedulerModalOpen || selectedHour === null) return null;

    const tempRange = tempUnit === 'C'
      ? Array.from({ length: MAX_TEMP_C - MIN_TEMP_C + 1 }, (_, i) => i + MIN_TEMP_C)
      : Array.from({ length: MAX_TEMP_F - MIN_TEMP_F + 1 }, (_, i) => i + MIN_TEMP_F);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className={`p-6 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-xl max-w-md w-full`}>
          <h2 className="text-xl font-bold mb-4">
            Set Temperature for {selectedRoom} at {format(new Date(0, 0, 0, selectedHour), 'HH:mm')}
          </h2>
          <div className="grid grid-cols-4 gap-2 max-h-[300px] overflow-y-auto">
            {tempRange.map(temp => (
              <button
                key={temp}
                onClick={() => setScheduledTemperature(tempUnit === 'C' ? temp : convertTemp(temp, 'C'))}
                className={`p-2 rounded ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`}
              >
                {temp}°{tempUnit}
              </button>
            ))}
          </div>
          <div className="mt-4 flex justify-between">
            <button
              onClick={() => setIsSchedulerModalOpen(false)}
              className={`px-4 py-2 rounded ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`}
            >
              Cancel
            </button>
            {scheduledTemps[selectedRoom][selectedHour] !== undefined && (
              <button
                onClick={() => removeScheduledTemperature(selectedHour)}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-slate-50 text-gray-900'} transition-colors duration-200`}>
      <div className="container mx-auto p-4 lg:p-8">
        <div className={`rounded-2xl shadow-xl backdrop-blur-sm ${darkMode ? 'bg-gray-800/90' : 'bg-white/90'} transition-colors duration-200`}>
          <div className="flex flex-col lg:flex-row">
            <div className="lg:w-1/3 p-6 lg:p-8 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">
                  JL Climate Control
                </h1>
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className={`p-2 rounded-full transition-colors duration-200 ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}
                >
                  {darkMode ? '☀️' : '🌙'}
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium opacity-70">Room</label>
                  <select
                    value={selectedRoom}
                    onChange={e => setSelectedRoom(e.target.value)}
                    className={`w-full p-3 rounded-xl border transition-colors duration-200 ${darkMode ? 'bg-gray-700 border-gray-600 focus:border-blue-500' : 'bg-white border-gray-200 focus:border-blue-500'}`}
                  >
                    {ROOMS.map(room => (
                      <option key={room} value={room}>{room}</option>
                    ))}
                  </select>
                </div>

                <div className={`rounded-xl p-4 ${darkMode ? 'bg-gray-700' : 'bg-blue-50'}`}>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium opacity-70">Inside</p>
                      <p className="text-3xl font-bold">
                        {tempUnit === 'C' ? insideTemp : convertTemp(insideTemp, 'F')}°{tempUnit}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium opacity-70">Outside</p>
                      <p className="text-3xl font-bold">
                        {tempUnit === 'C' ? outsideTemp : convertTemp(outsideTemp, 'F')}°{tempUnit}
                      </p>
                    </div>
                  </div>
                </div>

                <div className={`rounded-xl p-4 ${darkMode ? 'bg-gray-700' : 'bg-green-50'}`}>
                  <p className="text-sm font-medium opacity-70">Energy Consumption</p>
                  <p className="text-3xl font-bold">{roomData[selectedRoom].energyUsage.toFixed(2)} kWh</p>
                  <p className="text-sm font-medium opacity-70">Cost: &#8369;{roomData[selectedRoom].costInPesos.toFixed(2)}</p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium opacity-70">Location</label>
                  <select
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    className={`w-full p-3 rounded-xl border transition-colors duration-200 ${darkMode ? 'bg-gray-700 border-gray-600 focus:border-blue-500' : 'bg-white border-gray-200 focus:border-blue-500'}`}
                  >
                    {Object.keys(LOCATIONS).map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium opacity-70">Mode</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['off', 'cool', 'heat'].map(m => (
                      <button
                        key={m}
                        onClick={() => handleModeChange(m)}
                        className={`p-3 rounded-xl font-medium transition-all duration-200 ${mode === m ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}
                      >
                        {m.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium opacity-70">Fan</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['auto', 'on'].map(f => (
                      <button
                        key={f}
                        onClick={() => setFan(f)}
                        className={`p-3 rounded-xl font-medium transition-all duration-200 ${fan === f ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}
                      >
                        {f.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium opacity-70">Temperature Unit</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['C', 'F'].map(unit => (
                      <button
                        key={unit}
                        onClick={() => setTempUnit(unit)}
                        className={`p-3 rounded-xl font-medium transition-all duration-200 ${tempUnit === unit ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}
                      >
                        °{unit}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium opacity-70">
                    Desired Temperature: {tempUnit === 'C' ? desiredTemp : convertTemp(desiredTemp, 'F')}°{tempUnit}
                  </label>
                  <input
                    type="range"
                    min={tempUnit === 'C' ? MIN_TEMP_C : MIN_TEMP_F}
                    max={tempUnit === 'C' ? MAX_TEMP_C : MAX_TEMP_F}
                    value={tempUnit === 'C' ? desiredTemp : convertTemp(desiredTemp, 'F')}
                    onChange={e => setDesiredTemp(tempUnit === 'C' ? parseInt(e.target.value, 10) : convertTemp(parseInt(e.target.value, 10), 'C'))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  />
                </div>
              </div>
            </div>

            <div className="lg:w-2/3 p-6 lg:p-8">
              <div className="space-y-6">
                <div className={`rounded-xl p-4 ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'} h-[400px]`}>
                  <Line data={chartData} options={chartOptions as any} />
                </div>

                <div className="rounded-xl p-4 bg-gray-50 dark:bg-gray-700/50">
                  <h2 className="text-xl font-bold mb-4">Hourly Temperature Schedule</h2>
                  {renderHourlySchedule()}
                </div>

                <div className={`rounded-xl p-4 ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                  <h2 className="text-lg font-semibold mb-4">System Information</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-600' : 'bg-white'}`}>
                      <p className="text-sm opacity-70">Model</p>
                      <p className="font-medium">{airconSpecs.model}</p>
                    </div>
                    <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-600' : 'bg-white'}`}>
                      <p className="text-sm opacity-70">Energy Efficiency Ratio</p>
                      <p className="font-medium">{airconSpecs.eer}</p>
                    </div>
                    <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-600' : 'bg-white'}`}>
                      <p className="text-sm opacity-70">Power Consumption</p>
                      <p className="font-medium">{airconSpecs.wattage}W</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {renderSchedulerModal()}
    </div>
  );
}

export default App;
