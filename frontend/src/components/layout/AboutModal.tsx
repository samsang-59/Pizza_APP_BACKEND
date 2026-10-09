import { Modal } from '../ui/Modal';

export function AboutModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="About SkyTrace AI">
      <div className="space-y-3 text-sm leading-relaxed text-muted">
        <p className="text-base font-semibold text-ink">Every coordinate matters.</p>
        <p>
          SkyTrace AI is a hackathon prototype for <span className="text-ink">Problem 4</span>: when contact with an aircraft is lost, turn the last
          known position and what else is known — heading, speed, fuel, winds — into a clearer, plotted picture of the area worth searching.
        </p>
        <p>
          The frontend sends your inputs to a local FastAPI backend, which computes a straight-line baseline, heading-sensitivity scenarios, a
          buffered illustrative search region and a demonstration grid. Everything shown on screen comes from that backend; the browser does not
          call any external AI service.
        </p>
        <p className="rounded-lg border border-warn/30 bg-warn/10 p-3 text-ink">
          This is a demonstration tool. It does not locate real aircraft, does not compute operational search-and-rescue statistics, and must not
          be used for real search planning.
        </p>
        <p className="font-mono text-[11px]">React · TypeScript · Leaflet · FastAPI · Shapely · PyProj</p>
      </div>
    </Modal>
  );
}
