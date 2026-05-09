import { CSSProperties, KeyboardEvent, useEffect, useState } from 'react';

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

  useEffect(() => {
    setDraftValue(String(value));
  }, [value]);

  const normalize = () => {
    const parsed = Number.parseInt(draftValue, 10);
    const maxQuantity = typeof max === 'number' && Number.isFinite(max) ? Math.max(1, max) : null;
    let nextQuantity = Number.isFinite(parsed) ? parsed : 1;

    if (nextQuantity < 1) {
      nextQuantity = 1;
    }

    if (maxQuantity !== null && nextQuantity > maxQuantity) {
      nextQuantity = maxQuantity;
    }

    setDraftValue(String(nextQuantity));
    if (nextQuantity !== value) {
      onCommit(nextQuantity);
    }
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
      onChange={(event) => setDraftValue(event.target.value)}
      onBlur={normalize}
      onKeyDown={handleKeyDown}
      aria-label={ariaLabel}
      className={className}
      style={style}
      disabled={disabled}
    />
  );
}
