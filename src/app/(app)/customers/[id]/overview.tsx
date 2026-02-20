"use client";

import { Activity, Task, Customer } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Circle, Clock, Mail, Phone, Users, MessageSquare, Plus } from "lucide-react";
import { format } from "date-fns";
import { logActivityAction, createTaskAction } from "../actions";
import { useRef } from "react";

type CustomerWithRelations = Customer & {
  activities: Activity[];
  tasks: Task[];
};

export function OverviewTab({ customer }: { customer: CustomerWithRelations }) {
  const noteFormRef = useRef<HTMLFormElement>(null);
  const taskFormRef = useRef<HTMLFormElement>(null);

  async function handleAddNote(formData: FormData) {
    formData.append("customerId", customer.id);
    formData.append("type", "NOTE");
    formData.append("subject", "Note");
    await logActivityAction(formData);
    noteFormRef.current?.reset();
  }

  async function handleAddTask(formData: FormData) {
    formData.append("customerId", customer.id);
    formData.append("priority", "MEDIUM");
    await createTaskAction(formData);
    taskFormRef.current?.reset();
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Activity Feed */}
      <div className="md:col-span-2 space-y-6">
        <Card>
          <CardHeader className="pb-3 border-b bg-[hsl(var(--surface-elevated))]/50">
            <CardTitle className="text-base font-medium">Activity Feed</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {/* Quick Note Input */}
            <div className="mb-6 flex gap-3">
              <div className="h-9 w-9 rounded-full bg-[hsl(var(--surface-interactive))] flex items-center justify-center shrink-0">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
              </div>
              <form ref={noteFormRef} action={handleAddNote} className="flex-1">
                <Input
                  name="description"
                  placeholder="Log a note, call, or email details..."
                  className="mb-2"
                />
                <div className="flex justify-end">
                  <Button size="sm" variant="secondary">
                    Log Activity
                  </Button>
                </div>
              </form>
            </div>

            {/* Timeline */}
            <div className="relative pl-4 border-l border-border space-y-8">
              {customer.activities.map((activity) => (
                <div key={activity.id} className="relative z-10">
                  <div className="absolute -left-[21px] rounded-full bg-card border border-border p-1">
                    {activity.type === "CALL" && <Phone className="h-3 w-3 text-blue-500" />}
                    {activity.type === "EMAIL" && <Mail className="h-3 w-3 text-yellow-500" />}
                    {activity.type === "MEETING" && <Users className="h-3 w-3 text-purple-500" />}
                    {activity.type === "NOTE" && (
                      <MessageSquare className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>

                  <div className="text-sm">
                    <span className="font-medium text-foreground">{activity.type}</span>
                    <span className="text-muted-foreground mx-1">•</span>
                    <span className="text-muted-foreground">
                      {format(new Date(activity.createdAt), "MMM d, h:mm a")}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-foreground bg-[hsl(var(--surface-elevated))] p-3 rounded-lg border border-border/60">
                    {activity.description || activity.subject}
                  </div>
                </div>
              ))}

              {customer.activities.length === 0 && (
                <div className="text-sm text-muted-foreground italic pb-2">No activities yet.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar: Tasks & Info */}
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
            <CardTitle className="text-base font-medium">Tasks</CardTitle>
            <Button size="icon" variant="ghost" className="h-6 w-6">
              <Plus className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <form ref={taskFormRef} action={handleAddTask} className="flex gap-2 mb-4">
              <Input name="title" placeholder="Add a task..." className="h-9 text-sm" />
              <Button size="sm" type="submit" variant="default">
                Add
              </Button>
            </form>

            {customer.tasks.map((task) => (
              <div key={task.id} className="flex items-start gap-3 group">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-0.5 h-6 w-6 text-muted-foreground hover:text-green-600"
                >
                  <Circle className="h-4 w-4" />
                </Button>
                <div className="text-sm">
                  <div
                    className={`text-foreground ${task.status === "DONE" ? "line-through text-muted-foreground" : ""}`}
                  >
                    {task.title}
                  </div>
                  {task.dueDate && (
                    <div className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" />
                      {format(new Date(task.dueDate), "MMM d")}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {customer.tasks.length === 0 && (
              <div className="text-sm text-muted-foreground">No open tasks. Good job!</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-medium">Client Details</CardTitle>
          </CardHeader>
          <CardContent className="p-4 text-sm space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="text-muted-foreground">Created</div>
              <div className="col-span-2 text-foreground font-medium">
                {format(new Date(customer.createdAt), "MMM d, yyyy")}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-muted-foreground">Address</div>
              <div className="col-span-2 text-foreground">{customer.address || "—"}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
