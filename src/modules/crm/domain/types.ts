export const crmPermissions = {
  leadRead: "crm.lead.read",
  leadWrite: "crm.lead.write",
  leadQualify: "crm.lead.qualify",
  opportunityRead: "crm.opportunity.read",
  opportunityWrite: "crm.opportunity.write",
  opportunityApprove: "crm.opportunity.approve",
  campaignRead: "crm.campaign.read",
  campaignWrite: "crm.campaign.write",
  timelineRead: "crm.timeline.read",
} as const;

export type CrmPermission = (typeof crmPermissions)[keyof typeof crmPermissions];
