"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EmployeeForm } from "./employee-form";

export function EmployeeCreateDialog() {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus aria-hidden /> Add employee</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader className="pr-8">
          <DialogTitle>Add employee</DialogTitle>
          <DialogDescription>Set up their account and a temporary password.</DialogDescription>
        </DialogHeader>
        <EmployeeForm onCancel={() => setOpen(false)} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
