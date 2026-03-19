export function Dialog({ open }: { open?: boolean }) {
  return <div data-state={open ? "open" : "closed"} />;
}
