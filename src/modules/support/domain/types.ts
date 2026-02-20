export const supportPermissions = {
  queueRead: "support.queue.read",
  queueWrite: "support.queue.write",
  slaRead: "support.sla.read",
  slaWrite: "support.sla.write",
  ticketRead: "support.ticket.read",
  ticketWrite: "support.ticket.write",
  ticketManage: "support.ticket.manage",
  knowledgeBaseRead: "support.knowledge-base.read",
  knowledgeBaseWrite: "support.knowledge-base.write",
  knowledgeBaseManage: "support.knowledge-base.manage",
} as const;

export type SupportPermission = (typeof supportPermissions)[keyof typeof supportPermissions];
