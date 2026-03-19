export function Input({ disabled, value }: { disabled?: boolean; value?: string }) {
  return <input disabled={disabled} defaultValue={value} />;
}
