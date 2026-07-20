/**
 * UI slots — the injectable surface for host styling.
 *
 * The kit ships plain, unstyled defaults so it works with no wiring; a host
 * app passes its own design-system primitives (e.g. a shadcn `Button`, an
 * `Input`, a router `Link`) via {@link AiSettingsProvider} to make the
 * components match its look. All slots keep the same prop contract the
 * built-in components rely on.
 */

import * as React from "react";

/** Visual variants the components ask a Button slot for. A host Button may
 *  map these onto its own variant names; unknown values fall back to the
 *  default style. */
export type ButtonVariant =
    | "default"
    | "secondary"
    | "destructive"
    | "outline"
    | "link";

export type ButtonSize = "default" | "sm";

export interface ButtonSlotProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
}

export type ButtonSlot = React.ComponentType<ButtonSlotProps>;

export type InputSlotProps = React.InputHTMLAttributes<HTMLInputElement>;
export type InputSlot = React.ForwardRefExoticComponent<
    InputSlotProps & React.RefAttributes<HTMLInputElement>
>;

export interface LinkSlotProps {
    /** Destination href / route. */
    to: string;
    className?: string;
    children?: React.ReactNode;
    "data-testid"?: string;
}
export type LinkSlot = React.ComponentType<LinkSlotProps>;

/** Toast surface: a host maps these onto its notification system. */
export interface NotifyApi {
    success(message: string): void;
    error(message: string): void;
    warning(message: string): void;
}

export interface ConfirmOptions {
    message: string;
    confirmLabel?: string;
    variant?: "default" | "danger";
}

/** Confirmation prompt; resolves true when the user confirms. Default is a
 *  plain synchronous `window.confirm`. */
export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean> | boolean;

/** Default Button slot: a plain `<button>` carrying the variant/size as data
 *  attributes so a host stylesheet can target them without a component. */
export const DefaultButton: ButtonSlot = ({
    variant = "default",
    size = "default",
    children,
    ...rest
}) => (
    <button data-variant={variant} data-size={size} {...rest}>
        {children}
    </button>
);
DefaultButton.displayName = "DefaultButton";

/** Default Input slot: a plain forwardRef `<input>`. */
export const DefaultInput: InputSlot = React.forwardRef<
    HTMLInputElement,
    InputSlotProps
>((props, ref) => <input ref={ref} {...props} />);
DefaultInput.displayName = "DefaultInput";

/** Default Link slot: a plain `<a href>` (no client-side routing). */
export const DefaultLink: LinkSlot = ({ to, children, ...rest }) => (
    <a href={to} {...rest}>
        {children}
    </a>
);
DefaultLink.displayName = "DefaultLink";

/** Default notify: routes to `console`. A real app injects a toast system. */
export const defaultNotify: NotifyApi = {
    success: (message) => console.info(message),
    error: (message) => console.error(message),
    warning: (message) => console.warn(message),
};

/** Default confirm: the browser's synchronous `window.confirm`. */
export const defaultConfirm: ConfirmFn = ({ message }) => {
    if (typeof window !== "undefined" && typeof window.confirm === "function") {
        return window.confirm(message);
    }
    return true;
};
