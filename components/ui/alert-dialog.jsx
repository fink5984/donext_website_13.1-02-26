"use client"

import * as React from "react"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import X from "@/app/icons/x.svg"
import XHover from "@/app/icons/xHover.svg"

const AlertDialog = AlertDialogPrimitive.Root

const AlertDialogTrigger = AlertDialogPrimitive.Trigger

const AlertDialogPortal = AlertDialogPrimitive.Portal

const AlertDialogOverlay = React.forwardRef(({ hasOverlay = true, className, onClick, ...props }, ref) => (
  hasOverlay ?
    <AlertDialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 overlay cursor-pointer data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      onClick={onClick}
      {...props}
      ref={ref} />
    : <></>
))
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName

const AlertDialogContent = React.forwardRef(({ className, hasOverlay = true, hasCloseButton = true, onOverlayClick, ...props }, ref) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const cancelRef = React.useRef(null);

  const handleOverlayClick = (e) => {
    // Trigger the cancel button click to close the dialog
    if (cancelRef.current) {
      cancelRef.current.click();
    }
    onOverlayClick?.(e);
  };

  return (
    <AlertDialogPortal>
      {hasOverlay && <AlertDialogOverlay onClick={handleOverlayClick} />}
      <AlertDialogPrimitive.Content
        ref={ref}
        className={cn(
          "alertContent fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-0 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-[40px] max-h-[90vh] overflow-y-auto sm:rounded-[40px] rounded-[24px]",
          className
        )}
        {...props}>
        {/* Hidden cancel button for overlay click */}
        <AlertDialogPrimitive.Cancel
          ref={cancelRef}
          className="sr-only"
          aria-hidden="true"
        />
        {hasCloseButton && (
          <AlertDialogPrimitive.Cancel
            className="absolute right-[12px] top-[12px] sm:right-[24px] sm:top-[24px] p-1 cursor-pointer z-50"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {isHovered ? (
              <XHover style={{ color: 'var(--Brand-Blue-900, #103D98)' }} />
            ) : (
              <X style={{ color: 'var(--Icon-able-Icon, #0C4AD5)' }} />
            )}
          </AlertDialogPrimitive.Cancel>
        )}
        {props.children}
      </AlertDialogPrimitive.Content>
    </AlertDialogPortal>
  );
});
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName

const AlertDialogHeader = ({
  className,
  ...props
}) => (
  <div
    className={cn("flex flex-col space-y-2 text-center sm:text-left", className)}
    {...props} />
)
AlertDialogHeader.displayName = "AlertDialogHeader"

const AlertDialogFooter = ({
  className,
  ...props
}) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props} />
)
AlertDialogFooter.displayName = "AlertDialogFooter"

const AlertDialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold", className)} {...props} />
))
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName

const AlertDialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props} />
))
AlertDialogDescription.displayName =
  AlertDialogPrimitive.Description.displayName

const AlertDialogAction = React.forwardRef(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action ref={ref} className={cn(buttonVariants(), className)} {...props} />
))
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName

const AlertDialogCancel = React.forwardRef(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(
      // buttonVariants({ variant: "outline" }), "mt-2 sm:mt-0",
      className)}
    {...props} />
))
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
