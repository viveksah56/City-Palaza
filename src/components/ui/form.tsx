"use client";
import * as React from "react";
import { Controller, FormProvider, type ControllerProps, type FieldPath, type FieldValues } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const Form = FormProvider;
const FormFieldContext = React.createContext<{ name: string; error?: string } | null>(null);

function FormField<TValues extends FieldValues, TName extends FieldPath<TValues>>(props: ControllerProps<TValues, TName>) {
  const { render, ...controllerProps } = props;
  return (
    <Controller
      {...controllerProps}
      render={(fieldProps) => (
        <FormFieldContext.Provider value={{ name: fieldProps.field.name, error: fieldProps.fieldState.error?.message }}>
          {render(fieldProps)}
        </FormFieldContext.Provider>
      )}
    />
  );
}

function useFormField() {
  const field = React.useContext(FormFieldContext);
  if (!field) throw new Error("Form field components must be used inside FormField.");
  return { ...field, controlId: `${field.name}-control`, descriptionId: `${field.name}-description`, messageId: `${field.name}-message` };
}

function FormItem({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("grid gap-1.5", className)} {...props} />;
}

function FormLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  const { controlId } = useFormField();
  return <Label htmlFor={controlId} className={className} {...props} />;
}

function FormControl({ children }: { children: React.ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }> }) {
  const { controlId, descriptionId, messageId, error } = useFormField();
  const childDescribedBy = children.props["aria-describedby"];
  const describedBy = [childDescribedBy, descriptionId, error ? messageId : null].filter(Boolean).join(" ") || undefined;
  return React.cloneElement(children, { id: controlId, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy });
}

function FormDescription({ className, ...props }: React.ComponentProps<"p">) {
  const { descriptionId } = useFormField();
  return <p id={descriptionId} className={cn("text-xs leading-5 text-muted-foreground", className)} {...props} />;
}

function FormMessage({ className, children, ...props }: React.ComponentProps<"p">) {
  const { error, messageId } = useFormField();
  const message = error ?? children;
  if (!message) return null;
  return <p id={messageId} role="alert" className={cn("text-xs leading-5 font-medium text-destructive", className)} {...props}>{message}</p>;
}

export { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage };
