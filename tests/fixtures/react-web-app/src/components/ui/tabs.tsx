export function Tabs({ value }: { value?: string }) {
  return <div data-state={value ? "active" : "inactive"} />;
}
