export default function Modal({ title, onClose, children }) {
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head"><h2>{title}</h2><button className="ghost" onClick={onClose} aria-label="Close">×</button></div>
        {children}
      </div>
    </div>
  );
}
