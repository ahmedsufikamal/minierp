export interface NotificationService {
  sendInviteEmail(input: { to: string; companyName: string; invitationUrl: string; logoUrl?: string | null }): Promise<void>;
  sendMagicLinkEmail(input: { to: string; magicLinkUrl: string; logoUrl?: string | null }): Promise<void>;
  sendOtpEmail(input: { to: string; code: string; purpose: string; logoUrl?: string | null }): Promise<void>;
  sendOtpSms(input: { to: string; code: string; purpose: string }): Promise<void>;
  sendSecurityAlert(input: { to: string; event: string; ip?: string | null; userAgent?: string | null }): Promise<void>;
  sendRoleChanged(input: { to: string; roleName: string; companyName: string }): Promise<void>;
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
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: this.resendFrom, to, subject, html }),
    });
  }

  private async sendSms(to: string, body: string): Promise<void> {
    if (!this.twilioSid || !this.twilioToken || !this.twilioFrom) return;

    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.twilioSid}/Messages.json`;
    const params = new URLSearchParams({ To: to, From: this.twilioFrom, Body: body });
    const basic = Buffer.from(`${this.twilioSid}:${this.twilioToken}`).toString("base64");

    await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
  }

  async sendInviteEmail(input: { to: string; companyName: string; invitationUrl: string; logoUrl?: string | null }): Promise<void> {
    await this.sendEmail(
      input.to,
      `You are invited to ${input.companyName}`,
      `<p>You were invited to join <b>${input.companyName}</b>.</p><p><a href="${input.invitationUrl}">Accept invitation</a></p>`,
    );
  }

  async sendMagicLinkEmail(input: { to: string; magicLinkUrl: string }): Promise<void> {
    await this.sendEmail(input.to, "Your sign-in magic link", `<p><a href="${input.magicLinkUrl}">Sign in</a></p>`);
  }

  async sendOtpEmail(input: { to: string; code: string; purpose: string }): Promise<void> {
    await this.sendEmail(input.to, `Your ${input.purpose} code`, `<p>Your code is <b>${input.code}</b>.</p>`);
  }

  async sendOtpSms(input: { to: string; code: string; purpose: string }): Promise<void> {
    await this.sendSms(input.to, `Your ${input.purpose} code is ${input.code}`);
  }

  async sendSecurityAlert(input: { to: string; event: string; ip?: string | null; userAgent?: string | null }): Promise<void> {
    await this.sendEmail(input.to, "Security alert", `<p>${input.event}</p><p>IP: ${input.ip ?? "n/a"}</p><p>${input.userAgent ?? ""}</p>`);
  }

  async sendRoleChanged(input: { to: string; roleName: string; companyName: string }): Promise<void> {
    await this.sendEmail(input.to, `Your role changed in ${input.companyName}`, `<p>Your role is now <b>${input.roleName}</b>.</p>`);
  }
}

export function getNotificationService(): NotificationService {
  if (process.env.IAM_NOTIFICATION_PROVIDER === "http") {
    return new HttpNotificationService();
  }
  return new NoopNotificationService();
}
