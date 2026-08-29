'use client';

import styles from './OperationalExpandAllControl.module.css';

type OperationalExpandAllControlProps = {
  expanded: boolean;
  disabled?: boolean;
  onToggle: () => void;
  noun?: string;
};

export function OperationalExpandAllControl({
  expanded,
  disabled = false,
  onToggle,
  noun = 'entries',
}: OperationalExpandAllControlProps) {
  const action = expanded ? 'Collapse all' : 'Expand all';
  return (
    <button
      type="button"
      className={styles.control}
      onClick={onToggle}
      disabled={disabled}
      aria-label={`${action} visible ${noun}`}
      aria-pressed={expanded}
    >
      {action}
    </button>
  );
}
