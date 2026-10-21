import * as React from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Props = React.ComponentProps<typeof Button> & { label: string };

export function IconButton({ label, children, ...props }: Props) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="icon" aria-label={label} title={label} {...props}>{children}</Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
