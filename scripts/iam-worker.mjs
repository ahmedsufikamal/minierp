import { Worker } from "bullmq";

const queueName = process.env.IAM_QUEUE_NAME || "iam-notifications";
const redisUrl = process.env.REDIS_URL;
const resendApiKey = process.env.RESEND_API_KEY;
const resendFrom = process.env.RESEND_FROM_EMAIL || "no-reply@example.com";
const twilioSid = process.env.TWILIO_ACCOUNT_SID;
const twilioToken = process.env.TWILIO_AUTH_TOKEN;
const twilioFrom = process.env.TWILIO_FROM_PHONE;

if (!redisUrl) {
  console.error("REDIS_URL is required for IAM worker.");
  process.exit(1);
}

function parseRedisConnection(urlValue) {
  const url = new URL(urlValue);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    db: Number(url.pathname.replace("/", "") || 0),
    tls: url.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

async function sendEmail(to, subject, html) {
  if (!resendApiKey) return;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: resendFrom, to, subject, html }),
  });
  if (!response.ok) {
    throw new Error(`Resend request failed (${response.status})`);
  }
}

async function sendSms(to, body) {
  if (!twilioSid || !twilioToken || !twilioFrom) return;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
  const params = new URLSearchParams({ To: to, From: twilioFrom, Body: body });
  const basic = Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64");

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

async function processJob(name, data) {
  switch (name) {
    case "notification.invite_email": {
      const logo = data.logoUrl ? `<p><img src="${data.logoUrl}" alt="Company logo" height="36" /></p>` : "";
      await sendEmail(
        data.to,
        `You are invited to ${data.companyName}`,
        `${logo}<p>You were invited to join <b>${data.companyName}</b>.</p><p><a href="${data.invitationUrl}">Accept invitation</a></p>`,
      );
      return;
    }
    case "notification.magic_link_email": {
      const logo = data.logoUrl ? `<p><img src="${data.logoUrl}" alt="Company logo" height="36" /></p>` : "";
      await sendEmail(data.to, "Your sign-in magic link", `${logo}<p><a href="${data.magicLinkUrl}">Sign in</a></p>`);
      return;
    }
    case "notification.otp_email": {
      const logo = data.logoUrl ? `<p><img src="${data.logoUrl}" alt="Company logo" height="36" /></p>` : "";
      await sendEmail(data.to, `Your ${data.purpose} code`, `${logo}<p>Your code is <b>${data.code}</b>.</p>`);
      return;
    }
    case "notification.otp_sms":
      await sendSms(data.to, `Your ${data.purpose} code is ${data.code}`);
      return;
    case "notification.security_alert":
      await sendEmail(data.to, "Security alert", `<p>${data.event}</p><p>IP: ${data.ip ?? "n/a"}</p><p>${data.userAgent ?? ""}</p>`);
      return;
    case "notification.role_changed":
      await sendEmail(data.to, `Your role changed in ${data.companyName}`, `<p>Your role is now <b>${data.roleName}</b>.</p>`);
      return;
    default:
      throw new Error(`Unknown IAM notification job: ${name}`);
  }
}

const worker = new Worker(
  queueName,
  async (job) => {
    await processJob(job.name, job.data);
  },
  {
    connection: parseRedisConnection(redisUrl),
    concurrency: Math.max(1, Number(process.env.IAM_QUEUE_CONCURRENCY || 5)),
  },
);

worker.on("ready", () => {
  console.log(`[iam-worker] Listening on queue "${queueName}"`);
});

worker.on("failed", (job, error) => {
  console.error(`[iam-worker] Job failed: ${job?.name} (${job?.id})`, error);
});

worker.on("completed", (job) => {
  if (process.env.IAM_WORKER_VERBOSE === "1") {
    console.log(`[iam-worker] Job completed: ${job.name} (${job.id})`);
  }
});

async function shutdown(signal) {
  console.log(`[iam-worker] Received ${signal}, shutting down...`);
  await worker.close();
  process.exit(0);
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
