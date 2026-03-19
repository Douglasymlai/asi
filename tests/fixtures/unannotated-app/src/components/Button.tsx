export function Button(props: {
  id?: string;
  variant?: "default" | "destructive" | "outline";
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  [key: string]: unknown;
}) {
  return <button {...props} />;
}
