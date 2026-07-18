import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X, Eraser, Pen, ShieldCheck, Mail, Loader2 } from 'lucide-react';

interface SignatureModalProps {
  title: string;
  subtitle?: string;
  /** Draw a fresh PIN and email it. Returns dev PIN + target email for the UI hint. */
  onRequestOtp: () => Promise<{ devPin?: string; email?: string; emailed?: boolean }>;
  /**
   * Persist / verify the signature with the entered PIN. The parent decides what
   * this means (assessor verify-only vs. manager sign-and-save). Resolve with
   * success:false + a message to keep the modal open and show the error.
   */
  onVerify: (pin: string, signatureDataUrl: string) => Promise<{ success: boolean; error?: string }>;
  onClose: () => void;
}

type Stage = 'draw' | 'otp';

export const SignatureModal: React.FC<SignatureModalProps> = ({ title, subtitle, onRequestOtp, onVerify, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const [stage, setStage] = useState<Stage>('draw');
  const [signatureData, setSignatureData] = useState<string>('');

  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [devPin, setDevPin] = useState<string | undefined>(undefined);

  // Prepare a crisp canvas (handles high-DPI displays) once mounted.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#111827';
    }
  }, []);

  const pointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    drawing.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = pointerPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = pointerPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasDrawn) setHasDrawn(true);
  };

  const handlePointerUp = () => {
    drawing.current = false;
  };

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasDrawn(false);
  }, []);

  // Save the drawing → request a PIN → move to the OTP stage.
  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;
    const dataUrl = canvas.toDataURL('image/png');
    setSignatureData(dataUrl);
    setBusy(true);
    setError('');
    try {
      const res = await onRequestOtp();
      setDevPin(res.devPin);
      setInfo(
        res.emailed && res.email
          ? `A 4-digit PIN was sent to ${res.email}.`
          : res.email
            ? `A 4-digit PIN was generated for ${res.email}.`
            : 'A 4-digit PIN was generated.'
      );
      setStage('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the PIN. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await onRequestOtp();
      setDevPin(res.devPin);
      setPin('');
      setInfo(res.emailed && res.email ? `A new PIN was sent to ${res.email}.` : 'A new PIN was generated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the PIN. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    if (pin.length !== 4) {
      setError('Enter the 4-digit PIN.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await onVerify(pin, signatureData);
      if (result.success) {
        onClose();
      } else {
        setError(result.error || 'Incorrect PIN. Please try again.');
      }
    } catch {
      setError('Verification failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem'
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: '#ffffff', borderRadius: '10px', width: '100%', maxWidth: '460px',
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.35)', overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.1rem 1.25rem', borderBottom: '1px solid #eef0f2' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ display: 'inline-flex', width: 34, height: 34, borderRadius: '8px', background: '#EEF7F2', color: '#1D8A50', alignItems: 'center', justifyContent: 'center' }}>
              {stage === 'draw' ? <Pen size={17} /> : <ShieldCheck size={17} />}
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h3>
              {subtitle && <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{subtitle}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.25rem' }}>
          {stage === 'draw' && (
            <>
              <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Sign inside the box using your mouse (or finger on touch devices).
              </p>
              <canvas
                ref={canvasRef}
                style={{
                  width: '100%', height: '180px', border: '2px dashed #d1d5db', borderRadius: '8px',
                  background: '#fbfbfc', touchAction: 'none', cursor: 'crosshair', display: 'block'
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.6rem' }}>
                <button
                  type="button"
                  onClick={clearCanvas}
                  disabled={!hasDrawn || busy}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'none',
                    border: 'none', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600,
                    cursor: hasDrawn && !busy ? 'pointer' : 'not-allowed', opacity: hasDrawn && !busy ? 1 : 0.5
                  }}
                >
                  <Eraser size={14} /> Clear
                </button>
              </div>
              {error && <p style={{ margin: '0.6rem 0 0 0', fontSize: '0.78rem', color: '#C94C38' }}>{error}</p>}
            </>
          )}

          {stage === 'otp' && (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', background: '#EEF4FB', border: '1px solid #cfe0f5', borderRadius: '8px', padding: '0.75rem 0.85rem', marginBottom: '1rem' }}>
                <Mail size={16} style={{ color: '#2563eb', marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontSize: '0.8rem', color: '#1e40af' }}>{info}</span>
              </div>

              {devPin && (
                <div style={{ fontSize: '0.75rem', color: '#92400e', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '6px', padding: '0.4rem 0.6rem', marginBottom: '0.9rem' }}>
                  Dev mode (email relay not configured): your PIN is <strong>{devPin}</strong>
                </div>
              )}

              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                Enter 4-digit PIN
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                maxLength={4}
                value={pin}
                onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && pin.length === 4 && !busy) handleVerify(); }}
                placeholder="––––"
                style={{
                  width: '100%', textAlign: 'center', fontSize: '1.5rem', fontWeight: 700,
                  letterSpacing: '0.6rem', padding: '0.6rem', border: '1px solid #d1d5db',
                  borderRadius: '8px', color: 'var(--text-primary)'
                }}
              />
              {error && <p style={{ margin: '0.6rem 0 0 0', fontSize: '0.78rem', color: '#C94C38' }}>{error}</p>}

              <button
                type="button"
                onClick={handleResend}
                disabled={busy}
                style={{ marginTop: '0.75rem', background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '0.78rem', fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', padding: 0 }}
              >
                Resend PIN
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', padding: '1rem 1.25rem', borderTop: '1px solid #eef0f2', background: '#fafbfc' }}>
          {stage === 'draw' ? (
            <>
              <button type="button" className="btn btn-secondary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }} onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: '0.5rem 1.5rem', fontSize: '0.85rem', background: '#31b399', opacity: hasDrawn && !busy ? 1 : 0.55 }}
                onClick={handleSave}
                disabled={!hasDrawn || busy}
              >
                {busy ? <Loader2 size={15} className="spin" /> : null} Save
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-secondary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }} onClick={() => { setStage('draw'); setPin(''); setError(''); }} disabled={busy}>
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: '0.5rem 1.5rem', fontSize: '0.85rem', background: '#31b399', opacity: pin.length === 4 && !busy ? 1 : 0.55 }}
                onClick={handleVerify}
                disabled={pin.length !== 4 || busy}
              >
                {busy ? <Loader2 size={15} className="spin" /> : <ShieldCheck size={15} />} Confirm &amp; Save
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
