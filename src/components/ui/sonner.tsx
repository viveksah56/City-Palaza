"use client";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert } from "lucide-react";

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="top-center"
      closeButton={false}
      richColors={false}
      icons={{
        success: <CircleCheck className="size-4 text-success" aria-hidden="true" />,
        info: <Info className="size-4 text-primary" aria-hidden="true" />,
        warning: <TriangleAlert className="size-4 text-warning" aria-hidden="true" />,
        error: <CircleAlert className="size-4 text-destructive" aria-hidden="true" />,
        loading: <LoaderCircle className="size-4 animate-spin text-primary" aria-hidden="true" />,
      }}
      toastOptions={{
        classNames: {
          toast: "!rounded-xl !border !border-border !bg-popover !text-popover-foreground !shadow-card !font-sans",
          title: "!font-medium !text-sm",
          description: "!text-muted-foreground !text-[13px]",
          icon: "!mr-2",
        },
      }}
      {...props}
    />
  );
}
