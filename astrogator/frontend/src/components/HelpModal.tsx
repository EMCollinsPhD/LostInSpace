import React from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';

interface HelpModalProps {
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => {
  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
      <div className="bg-slate-800 border border-slate-600 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-900">
          <h2 className="text-xl font-bold text-green-400 tracking-wider">GNC OPERATING MANUAL</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6 text-slate-300">
          <section>
            <h3 className="text-lg font-bold text-white mb-2 border-b border-slate-700 pb-1">1. NAVIGATION SENSORS</h3>
            <p className="mb-2">
              The <span className="text-green-400">Primary Optical Sensor</span> (Star Tracker) provides a view of the celestial sphere from your spacecraft.
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm bg-slate-900 p-3 rounded">
              <li><span className="text-white">White Dots:</span> Distant stars (Fixed reference).</li>
              <li><span className="text-cyan-400">Cyan/Yellow Dots:</span> Solar system bodies (Planets/Sun).</li>
              <li><strong>Interaction:</strong> Hover over any object to identify it and see its Right Ascension (RA) and Declination (DEC).</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-bold text-white mb-2 border-b border-slate-700 pb-1">2. MANEUVER EXECUTION</h3>
            <p className="mb-2">
              Use the <span className="text-green-400">Maneuver Control</span> panel to change your specific orbital energy.
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm bg-slate-900 p-3 rounded">
              <li>Enter the Delta-V vector components (X, Y, Z) in <strong>km/s</strong>.</li>
              <li>Click <strong>EXECUTE BURN</strong> to unconditionally apply the impulse.</li>
              <li><span className="text-yellow-500">Warning:</span> Fuel is limited. Verify your calculations before burning.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-bold text-white mb-2 border-b border-slate-700 pb-1">3. SYSTEM UPDATES</h3>
            <p className="text-sm">
              Telemetry is updated every 60 seconds to conserve bandwidth. Click <span className="text-xs bg-slate-700 px-1 rounded border border-slate-600">REFRESH DATA</span> to force an immediate update of the state vector and sensor view.
            </p>
          </section>
        </div>

        <div className="p-4 border-t border-slate-700 bg-slate-900 flex justify-end">
          <button
            onClick={onClose}
            className="bg-green-900/20 hover:bg-green-900/40 text-green-400 px-6 py-2 rounded border border-green-800 transition-colors"
          >
            ACKNOWLEDGE
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default HelpModal;
