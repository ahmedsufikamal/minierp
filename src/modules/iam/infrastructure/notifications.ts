import { getIamQueue, registerIamInlineProcessor, type QueueJob } from "@/modules/iam/infrastructure/queue";

type InviteEmailPayload = { to: string; companyName: string; invitationUrl: string; logoUrl?: string | null };
type MagicLinkPayload = { to: string; magicLinkUrl: string; logoUrl?: string | null };
type OtpEmailPayload = { to: string; code: string; purpose: string; logoUrl?: string | null };
type OtpSmsPayload = { to: string; code: string; purpose: string };
type SecurityAlertPayload = { to: string; event: string; ip?: string | null; userAgent?: string | null };
type RoleChangedPayload = { to: string; roleName: string; companyName: string };

export type IamNotificationJobName =
  | "notification.invite_email"
  | "notification.magic_link_email"
  | "notification.otp_email"
  | "notification.otp_sms"
  | "notification.security_alert"
  | "notification.role_changed";

export interface NotificationService {
  sendInviteEmail(input: InviteEmailPayload): Promise<void>;
  sendMagicLinkEmail(input: MagicLinkPayload): Promise<void>;
  sendOtpEmail(input: OtpEmailPayload): Promise<void>;
  sendOtpSms(input: OtpSmsPayload): Promise<void>;
  sendSecurityAlert(input: SecurityAlertPayload): Promise<void>;
  sendRoleChanged(input: RoleChangedPayload): Promise<void>;
}

class NoopNotificationService implements NotificationService {
  async sendInviteEmail(): Promise<void> {}
  async sendMagicLinkEmail(): Promise<void> {}
  async sendOtpEmail(): Promise<void> {}
  async sendOtpSms(): Promise<void> {}
  async sendSecurityAlert(): Promise<void> {}
  async sendRoleChanged(): Promise<void> {}
}

class HttpNotificationService implements NotificationService {
  private readonly resendApiKey = process.env.RESEND_API_KEY;
  private readonly resendFrom = process.env.RESEND_FROM_EMAIL ?? "no-reply@example.com";
  private readonly twilioSid = process.env.TWILIO_ACCOUNT_SID;
  private readonly twilioToken = process.env.TWILIO_AUTH_TOKEN;
  private readonly twilioFrom = process.env.TWILIO_FROM_PHONE;

  private async sendEmail(to: string, subject: string, html: string): Promise<void> {
    if (!this.resendApiKey) return;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: this.resendFrom, to, subject, html }),
    });
    if (!response.ok) {
      throw new Error(`Resend request failed (${response.status})`);
    }
  }

  private async sendSms(to: string, body: string): Promise<void> {
    if (!this.twilioSid || !this.twilioToken || !this.twilioFrom) return;

    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.twilioSid}/Messages.json`;
    const params = new URLSearchParams({ To: to, From: this.twilioFrom, Body: body });
    const basic = Buffer.from(`${this.twilioSid}:${this.twilioToken}`).toString("base64");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    if (!response.ok) {
      throw new Error(`Twilio request failed (${response.status})`);
    }
  }

  async sendInviteEmail(input: InviteEmailPayload): Promise<void> {
    const logo = input.logoUrl ? `<p><img src="${input.logoUrl}" alt="Company logo" height="36" /></p>` : "";
    await this.sendEmail(
      input.to,
      `You are invited to ${input.companyName}`,
      `${logo}<p>You were invited to join <b>${input.companyName}</b>.</p><p><a href="${input.invitationUrl}">Accept invitation</a></p>`,
    );
  }

  async sendMagicLinkEmail(input: MagicLinkPayload): Promise<void> {
    const logo = input.logoUrl ? `<p><img src="${input.logoUrl}" alt="Company logo" height="36" /></p>` : "";
    await this.sendEmail(input.to, "Your sign-in magic link", `${logo}<p><a href="${input.magicLinkUrl}">Sign in</a></p>`);
  }

  async sendOtpEmail(input: OtpEmailPayload): Promise<void> {
    const logo = input.logoUrl ? `<p><img src="${input.logoUrl}" alt="Company logo" height="36" /></p>` : "";
    await this.sendEmail(input.to, `Your ${input.purpose} code`, `${logo}<p>Your code is <b>${input.code}</b>.</p>`);
  }

  async sendOtpSms(input: OtpSmsPayload): Promise<void> {
    await this.sendSms(input.to, `Your ${input.purpose} code is ${input.code}`);
  }

  async sendSecurityAlert(input: SecurityAlertPayload): Promise<void> {
    await this.sendEmail(input.to, "Security alert", `<p>${input.event}</p><p>IP: ${input.ip ?? "n/a"}</p><p>${input.userAgent ?? ""}</p>`);
  }

  async sendRoleChanged(input: RoleChangedPayload): Promise<void> {
    await this.sendEmail(input.to, `Your role changed in ${input.companyName}`, `<p>Your role is now <b>${input.roleName}</b>.</p>`);
  }
}

class QueueBackedNotificationService implements NotificationService {
  private readonly queue = getIamQueue();

  private async enqueue<T>(name: IamNotificationJobName, payload: T): Promise<void> {
    await this.queue.enqueue({
      name,
      payload,
      attempts: 4,
      backoffMs: 1_000,
    });
  }

  async sendInviteEmail(input: InviteEmailPayload): Promise<void> {
    await this.enqueue("notification.invite_email", input);
  }

  async sendMagicLinkEmail(input: MagicLinkPayload): Promise<void> {
    await this.enqueue("notification.magic_link_email", input);
  }

  async sendOtpEmail(input: OtpEmailPayload): Promise<void> {
    await this.enqueue("notification.otp_email", input);
  }

  async sendOtpSms(input: OtpSmsPayload): Promise<void> {
    await this.enqueue("notification.otp_sms", input);
  }

  async sendSecurityAlert(input: SecurityAlertPayload): Promise<void> {
    await this.enqueue("notification.security_alert", input);
  }

  async sendRoleChanged(input: RoleChangedPayload): Promise<void> {
    await this.enqueue("notification.role_changed", input);
  }
}

function getDeliveryService(): NotificationService {
  if ((process.env.IAM_NOTIFICATION_PROVIDER ?? "http").toLowerCase() === "http") {
    return new HttpNotificationService();
  }
  return new NoopNotificationService();
}

let cachedNotificationService: NotificationService | null = null;
let cachedDeliveryService: NotificationService | null = null;

function directDeliveryService(): NotificationService {
  if (!cachedDeliveryService) {
    cachedDeliveryService = getDeliveryService();
  }
  return cachedDeliveryService;
}

function parsePayload<T>(value: unknown): T {
  if (typeof value !== "object" || !value) {
    throw new Error("Invalid notification payload");
  }
  return value as T;
}

export async function processIamNotificationJob(job: QueueJob<unknown>): Promise<void> {
  const delivery = directDeliveryService();

  switch (job.name as IamNotificationJobName) {
    case "notification.invite_email":
      await delivery.sendInviteEmail(parsePayload<InviteEmailPayload>(job.payload));
      return;
    case "notification.magic_link_email":
      await delivery.sendMagicLinkEmail(parsePayload<MagicLinkPayload>(job.payload));
      return;
    case "notification.otp_email":
      await delivery.sendOtpEmail(parsePayload<OtpEmailPayload>(job.payload));
      return;
    case "notification.otp_sms":
      await delivery.sendOtpSms(parsePayload<OtpSmsPayload>(job.payload));
      return;
    case "notification.security_alert":
      await delivery.sendSecurityAlert(parsePayload<SecurityAlertPayload>(job.payload));
      return;
    case "notification.role_changed":
      await delivery.sendRoleChanged(parsePayload<RoleChangedPayload>(job.payload));
      return;
    default:
      throw new Error(`Unknown IAM notification job: ${job.name}`);
  }
}

registerIamInlineProcessor(processIamNotificationJob);

export function getNotificationService(): NotificationService {
  if (cachedNotificationService) {
    return cachedNotificationService;
  }
  cachedNotificationService = new QueueBackedNotificationService();
  return cachedNotificationService;
}
