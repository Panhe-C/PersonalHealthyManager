import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";

export function ActionButton({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" }) {
  return <button {...props} className={clsx("button", variant === "secondary" && "button-secondary", className)} />;
}
