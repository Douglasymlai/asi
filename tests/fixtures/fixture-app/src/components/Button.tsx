type ButtonProps = {
  id?: string;
  variant?: "default" | "destructive" | "secondary";
  children: string;
  [key: string]: unknown;
};

export function Button(props: ButtonProps) {
  return <button {...props}>{props.children}</button>;
}
