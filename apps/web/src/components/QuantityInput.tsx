import { CSSProperties, ChangeEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';

/** Sepet / ürün listesinde miktar değişince toplamların gecikmemesi için kısa debounce ile store’a yazılır. */
const QUANTITY_COMMIT_DEBOUNCE_MS = 400;

interface QuantityInputProps {
  value: number;
  onCommit: (quantity: number) => void;
  max?: number | null;
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
}

export default function QuantityInput({
  value,
  onCommit,
  max,
  ariaLabel = 'Miktar',
  className,
  style,
  disabled = false,
}: QuantityInputProps) {
  const [draftValue, setDraftValue] = useState(String(value));
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraftValue(String(value));
  }, [value]);

  useEffect(
    () => () => {
      if (commitTimerRef.current) {
        clearTimeout(commitTimerRef.current);
        commitTimerRef.current = null;
      }
    },
    [],
  );

  const flushPendingCommit = () => {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
  };

  const clampQuantity = (raw: number) => {
    const maxQuantity = typeof max === 'number' && Number.isFinite(max) ? Math.max(1, max) : null;
    let nextQuantity = Number.isFinite(raw) ? raw : 1;
    if (nextQuantity < 1) {
      nextQuantity = 1;
    }
    if (maxQuantity !== null && nextQuantity > maxQuantity) {
      nextQuantity = maxQuantity;
    }
    return nextQuantity;
  };

  const commitIfNeeded = (nextQuantity: number) => {
    if (nextQuantity !== value) {
      onCommit(nextQuantity);
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const rawString = event.target.value;
    setDraftValue(rawString);
    flushPendingCommit();
    if (rawString.trim() === '') {
      return;
    }
    const parsed = Number.parseInt(rawString, 10);
    if (!Number.isFinite(parsed)) {
      return;
    }
    const nextQuantity = clampQuantity(parsed);
    commitTimerRef.current = setTimeout(() => {
      commitTimerRef.current = null;
      commitIfNeeded(nextQuantity);
    }, QUANTITY_COMMIT_DEBOUNCE_MS);
  };

  const normalize = () => {
    flushPendingCommit();
    const parsed = Number.parseInt(draftValue, 10);
    let nextQuantity = Number.isFinite(parsed) ? parsed : 1;
    nextQuantity = clampQuantity(nextQuantity);
    setDraftValue(String(nextQuantity));
    commitIfNeeded(nextQuantity);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    }
  };

  return (
    <input
      type="number"
      inputMode="numeric"
      min="1"
      max={typeof max === 'number' && Number.isFinite(max) ? max : undefined}
      value={draftValue}
      onChange={handleChange}
      onBlur={normalize}
      onKeyDown={handleKeyDown}
      aria-label={ariaLabel}
      className={className}
      style={style}
      disabled={disabled}
    />
  );
}
