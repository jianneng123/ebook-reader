import { useEffect, useState } from 'preact/hooks';

type Props = { value: number; onJump: (percent: number) => void };

/** F6：按百分比跳转，不提供目录树。 */
export function ProgressBar({ value, onJump }: Props) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <div class="progress-bar">
      <span class="progress-label">跳转</span>
      <input
        class="progress-range"
        type="range"
        min="0"
        max="100"
        value={draft}
        onInput={(event) => setDraft(Number((event.target as HTMLInputElement).value))}
      />
      <button class="btn" onClick={() => onJump(draft)}>
        跳到 {Math.round(draft)}%
      </button>
      <span class="progress-value">当前 {Math.round(value)}%</span>
    </div>
  );
}
