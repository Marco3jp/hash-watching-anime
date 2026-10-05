/** 並びを入れ替える小さなボタン。話の一覧と、シリーズのシーズンの並びで使う */
export function MoveButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="btn-icon text-xs"
    >
      {children}
    </button>
  );
}
