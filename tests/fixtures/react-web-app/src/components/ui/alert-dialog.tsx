export function AlertDialog({ open }: { open?: boolean }) {
  return <div data-state={open ? "open" : "closed"} />;
}
