export function Sheet({ open }: { open?: boolean }) {
  return <div data-state={open ? "open" : "closed"} />;
}
