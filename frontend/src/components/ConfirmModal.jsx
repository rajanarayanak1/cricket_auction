export default function ConfirmModal({
  icon = '⚠️',
  title,
  message,
  confirmLabel = 'Proceed',
  cancelLabel = 'Cancel',
  confirmVariant = 'success',
  confirming = false,
  error = '',
  onCancel,
  onConfirm,
  children
}) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="card-title-row">
            <span className="card-icon-badge">{icon}</span>
            <h3 style={{ margin: 0 }}>{title}</h3>
          </div>
          <button className="modal-close-btn" onClick={onCancel}>✕</button>
        </div>

        <p className="confirm-modal-message">{message}</p>

        {children}

        {error && <p className="error-text">{error}</p>}

        <div className="modal-footer-actions">
          <button className="btn btn-secondary" onClick={onCancel} disabled={confirming}>
            {cancelLabel}
          </button>
          <button className={`btn btn-${confirmVariant}`} onClick={onConfirm} disabled={confirming}>
            {confirming ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
