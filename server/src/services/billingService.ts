import Stripe from "stripe";
import { env } from "../config/env.js";
import type { UserSubscriptionInterval } from "../types/user.js";
import {
  createTeamPlanRequest as createTeamPlanRequestRecord,
  findBillingUserById,
  findUserIdByStripeCustomerId,
  setStripeCustomerId,
  updateUserSubscriptionPlan
} from "./userRepository.js";

const stripe = env.stripeSecretKey ? new Stripe(env.stripeSecretKey) : null;

type CheckoutPlanCode = "individual-monthly" | "individual-quarterly" | "individual-annual";

const PLAN_CONFIG: Record<CheckoutPlanCode, { priceId: string; interval: UserSubscriptionInterval }> = {
  "individual-monthly": {
    priceId: env.stripePriceIndividualMonthly,
    interval: "monthly"
  },
  "individual-quarterly": {
    priceId: env.stripePriceIndividualQuarterly,
    interval: "quarterly"
  },
  "individual-annual": {
    priceId: env.stripePriceIndividualAnnual,
    interval: "annual"
  }
};

export async function createCheckoutSession(input: { userId: string; plan: CheckoutPlanCode }): Promise<string> {
  ensureBillingConfigured();
  const user = await findBillingUserById(input.userId);
  if (!user) {
    throw new Error("User not found");
  }

  const plan = PLAN_CONFIG[input.plan];
  if (!plan?.priceId) {
    throw new Error(`Stripe price is not configured for ${input.plan}`);
  }

  const customerId = await getOrCreateCustomerId(user.id, user.email, user.name, user.stripeCustomerId);

  const session = await stripe!.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: plan.priceId, quantity: 1 }],
    success_url: withCheckoutSessionId(env.billingSuccessUrl),
    cancel_url: env.billingCancelUrl,
    metadata: {
      userId: user.id,
      plan: "individual",
      interval: plan.interval ?? ""
    }
  });

  if (!session.url) {
    throw new Error("Failed to create checkout session");
  }

  return session.url;
}

export async function syncCheckoutSession(input: { userId: string; sessionId: string }): Promise<void> {
  ensureBillingConfigured();
  const user = await findBillingUserById(input.userId);
  if (!user) {
    throw new Error("User not found");
  }

  const session = await stripe!.checkout.sessions.retrieve(input.sessionId, {
    expand: ["subscription"]
  });

  const customerId = typeof session.customer === "string" ? session.customer : null;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription && typeof session.subscription === "object"
        ? session.subscription.id
        : null;
  const interval = normalizeInterval(session.metadata?.interval ?? null);
  const status = session.status;
  const paymentStatus = session.payment_status;

  if (customerId !== user.stripeCustomerId) {
    throw new Error("Checkout session does not belong to this user");
  }

  if (!subscriptionId || !interval || status !== "complete" || paymentStatus !== "paid") {
    return;
  }

  const subscription =
    typeof session.subscription === "object" && session.subscription
      ? session.subscription
      : await stripe!.subscriptions.retrieve(subscriptionId);

  await updateUserSubscriptionPlan(
    user.id,
    "individual",
    interval,
    subscriptionId,
    customerId,
    getSubscriptionPeriodStart(subscription),
    subscription.items.data[0]?.current_period_end ? new Date(subscription.items.data[0].current_period_end * 1000) : null
  );
}

export async function createBillingPortalSession(userId: string): Promise<string> {
  ensureBillingConfigured();
  const user = await findBillingUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  const customerId = user.stripeCustomerId;
  if (!customerId) {
    throw new Error("No Stripe customer found for this account");
  }

  const session = await stripe!.billingPortal.sessions.create({
    customer: customerId,
    return_url: env.billingSuccessUrl
  });

  return session.url;
}

export async function createTeamPlanRequest(input: {
  userId: string;
  companyName: string | null;
  workEmail: string;
  seatCount: number | null;
  notes: string | null;
}): Promise<void> {
  await createTeamPlanRequestRecord(input);
}

export async function handleStripeWebhook(rawBody: Buffer, signature: string): Promise<void> {
  ensureBillingConfigured();
  if (!env.stripeWebhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }

  const event = stripe!.webhooks.constructEvent(rawBody, signature, env.stripeWebhookSecret);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId ?? session.client_reference_id ?? null;
      const customerId = typeof session.customer === "string" ? session.customer : null;
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
      const interval = normalizeInterval(session.metadata?.interval ?? null);

      if (!userId || !customerId || !subscriptionId || !interval) {
        return;
      }

      const subscription = await stripe!.subscriptions.retrieve(subscriptionId);
      await updateUserSubscriptionPlan(
        userId,
        "individual",
        interval,
        subscriptionId,
        customerId,
        getSubscriptionPeriodStart(subscription),
        subscription.items.data[0]?.current_period_end
          ? new Date(subscription.items.data[0].current_period_end * 1000)
          : null
      );
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.created":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
      if (!customerId) {
        return;
      }

      const userId = await findUserIdByStripeCustomerId(customerId);
      if (!userId) {
        return;
      }

      const interval = mapSubscriptionToInterval(subscription);
      const activeLike = subscription.status === "active" || subscription.status === "trialing" || subscription.status === "past_due";

      if (activeLike && interval) {
        await updateUserSubscriptionPlan(
          userId,
          "individual",
          interval,
          subscription.id,
          customerId,
          getSubscriptionPeriodStart(subscription),
          subscription.items.data[0]?.current_period_end
            ? new Date(subscription.items.data[0].current_period_end * 1000)
            : null
        );
      } else {
        await updateUserSubscriptionPlan(userId, "free", null, null, customerId, null, null);
      }
      break;
    }
    default:
      break;
  }
}

function ensureBillingConfigured(): void {
  if (!stripe) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
}

async function getOrCreateCustomerId(
  userId: string,
  email: string,
  name: string,
  existingCustomerId: string | null
): Promise<string> {
  if (existingCustomerId) {
    return existingCustomerId;
  }

  const customer = await stripe!.customers.create({
    email,
    name,
    metadata: { userId }
  });

  await setStripeCustomerId(userId, customer.id);
  return customer.id;
}

function normalizeInterval(value: string | null): UserSubscriptionInterval {
  if (value === "monthly" || value === "quarterly" || value === "annual" || value === "custom") {
    return value;
  }
  return null;
}

function mapSubscriptionToInterval(subscription: Stripe.Subscription): UserSubscriptionInterval {
  const item = subscription.items.data[0];
  const interval = item?.price?.recurring?.interval;
  const count = item?.price?.recurring?.interval_count ?? 1;

  if (interval === "month" && count === 1) {
    return "monthly";
  }
  if (interval === "month" && count === 3) {
    return "quarterly";
  }
  if (interval === "year") {
    return "annual";
  }
  return "custom";
}

function withCheckoutSessionId(url: string): string {
  const separator = url.includes("?") ? "&" : "?";
  if (url.includes("session_id={CHECKOUT_SESSION_ID}")) {
    return url;
  }
  return `${url}${separator}session_id={CHECKOUT_SESSION_ID}`;
}

function getSubscriptionPeriodStart(subscription: Stripe.Subscription): Date | null {
  const direct = (subscription as { current_period_start?: number }).current_period_start;
  if (typeof direct === "number" && Number.isFinite(direct)) {
    return new Date(direct * 1000);
  }

  const itemStart = (subscription.items.data[0] as { current_period_start?: number } | undefined)?.current_period_start;
  if (typeof itemStart === "number" && Number.isFinite(itemStart)) {
    return new Date(itemStart * 1000);
  }

  return null;
}
