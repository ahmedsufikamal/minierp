export const supportPermissions = {
  queueRead: "support.queue.read",
  queueWrite: "support.queue.write",
  slaRead: "support.sla.read",
  slaWrite: "support.sla.write",
  ticketRead: "support.ticket.read",
  ticketWrite: "support.ticket.write",
  ticketManage: "support.ticket.manage",
} as const;

export type SupportPermission = (typeof supportPermissions)[keyof typeof supportPermissions];
