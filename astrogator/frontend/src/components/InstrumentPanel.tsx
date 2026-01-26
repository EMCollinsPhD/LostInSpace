import React, { useEffect, useState } from 'react';
import axios from 'axios';
import StarTracker from './StarTracker';
import HelpModal from './HelpModal';
import { Rocket, Info, HelpCircle } from 'lucide-react';

interface NavState {
  time: {
    et: number;
    utc: string;
  };
  observables: {
    bodies: any[];
    stars: any[];
  };
  fuel: number;
}

const InstrumentPanel: React.FC = () => {
  const [state, setState] = useState<NavState | null>(null);
  const [burnVector, setBurnVector] = useState({ x: 0, y: 0, z: 0 });
  const [statusMsg, setStatusMsg] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  const fetchState = async () => {
    try {
      const res = await axios.get('http://localhost:8000/api/nav/state/student1');
      setState(res.data);
    } catch (e) {
      console.error("Connection Lost", e);
    }
  };

  useEffect(() => {
    fetchState(); // Initial Load
    const interval = setInterval(fetchState, 60000); // 1 minute update
    return () => clearInterval(interval);
  }, []);

  const handleBurn = async () => {
    try {
      await axios.post('http://localhost:8000/api/cmd/burn/student1', {
        delta_v: burnVector,
        utc_time: state?.time.utc || ""
      });
      setStatusMsg('Engine Burn Executed.');
      setTimeout(() => setStatusMsg(''), 3000);
      fetchState();
    } catch (e) {
      setStatusMsg('Burn Failed: Comm Error');
    }
  };

  if (!state) return <div className="p-10 text-green-500 font-mono">Initializing GNC Link...</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-6 font-mono flex flex-col gap-6">
      <header className="flex justify-between items-center border-b border-slate-700 pb-4">
        <h1 className="text-2xl font-bold tracking-widest text-green-500">ASTROGATOR <span className="text-xs text-slate-500">v1.0</span></h1>
        <div className="flex gap-4 text-sm items-center">
          <button
            onClick={() => setShowHelp(true)}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-blue-400 px-3 py-1 rounded border border-slate-600 transition-colors"
          >
            <HelpCircle size={16} /> HELP
          </button>
          <button
            onClick={() => fetchState()}
            className="bg-slate-800 hover:bg-slate-700 text-green-400 px-3 py-1 rounded border border-slate-600 transition-colors"
          >
            REFRESH DATA
          </button>
          <div className="bg-slate-800 px-3 py-1 rounded">
            <span className="text-slate-400">JD-UTC:</span> {state.time.utc}
          </div>
          <div className="bg-slate-800 px-3 py-1 rounded">
            <span className="text-slate-400">FUEL:</span> {state.fuel.toFixed(1)} m/s
          </div>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Star Tracker View - Main Screen */}
        <div className="lg:col-span-2 flex flex-col gap-2">
          <div className="flex justify-between items-end">
            <h2 className="text-sm text-slate-400 flex items-center gap-2"><Info size={16} /> PRIMARY OPTICAL SENSOR (STAR TRACKER)</h2>
          </div>
          <div className="flex-1 min-h-[400px]">
            <StarTracker stars={state.observables.stars} bodies={state.observables.bodies} />
          </div>
        </div>

        {/* Control Station */}
        <div className="bg-slate-800 p-6 rounded-lg flex flex-col gap-6 border border-slate-700">
          <div>
            <h3 className="text-lg font-bold text-green-500 mb-4 flex items-center gap-2"><Rocket /> MANEUVER CONTROL</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase text-slate-500 mb-1">Delta-V X (km/s)</label>
                <input
                  type="number" step="0.001"
                  value={burnVector.x} onChange={e => setBurnVector({ ...burnVector, x: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-green-400 focus:outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-xs uppercase text-slate-500 mb-1">Delta-V Y (km/s)</label>
                <input
                  type="number" step="0.001"
                  value={burnVector.y} onChange={e => setBurnVector({ ...burnVector, y: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-green-400 focus:outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-xs uppercase text-slate-500 mb-1">Delta-V Z (km/s)</label>
                <input
                  type="number" step="0.001"
                  value={burnVector.z} onChange={e => setBurnVector({ ...burnVector, z: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-green-400 focus:outline-none focus:border-green-500"
                />
              </div>

              <button
                onClick={handleBurn}
                className="w-full mt-4 bg-red-900 hover:bg-red-800 text-red-100 py-3 rounded font-bold border border-red-700 transition-colors uppercase tracking-wider"
              >
                EXECUTE BURN
              </button>
              {statusMsg && <div className="text-center text-xs text-yellow-500 animate-pulse">{statusMsg}</div>}
            </div>
          </div>

          <div className="mt-auto bg-slate-900 p-4 rounded text-xs text-slate-400 border border-slate-700">
            <h4 className="font-bold text-slate-300 mb-2">SYSTEM STATUS</h4>
            <ul className="space-y-1">
              <li className="flex justify-between"><span>GNC Computer:</span> <span className="text-green-500">ONLINE</span></li>
              <li className="flex justify-between"><span>Star Tracker:</span> <span className="text-green-500">LOCKED</span></li>
              <li className="flex justify-between"><span>Comm Link:</span> <span className="text-red-500">OFFLINE (SIM)</span></li>
            </ul>
          </div>
        </div>
      </main>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
};

export default InstrumentPanel;
