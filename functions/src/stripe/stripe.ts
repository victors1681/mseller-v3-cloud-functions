import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { logger } from 'firebase-functions/v2';
import { CallableRequest, HttpsError, onCall } from 'firebase-functions/v2/https';
import Stripe from 'stripe';
import { IBusiness } from '../business/businessType';
import { BUSINESS_COLLECTION } from '../index';

interface CreateSubscriptionProps {
    price: string;
    quantity: number;
    tier: string;
    token: string;
}

// Type guard to check if latest_invoice is an instance of Stripe.Invoice
function isInvoice(latest_invoice: string | Stripe.Invoice | null): latest_invoice is Stripe.Invoice {
    return latest_invoice !== null && (latest_invoice as Stripe.Invoice).id !== undefined;
}

function isPaymentIntent(latest_invoice: string | Stripe.PaymentIntent | null): latest_invoice is Stripe.PaymentIntent {
    return latest_invoice !== null && (latest_invoice as Stripe.PaymentIntent).id !== undefined;
}

export const CreateSubscription = onCall(async (request: CallableRequest<CreateSubscriptionProps>) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to create a subscription.');
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
    const { price, quantity, tier, token } = request.data;

    try {
        // Fetch Firebase Auth user and custom claims
        const userRecord = await admin.auth().getUser(request.auth.uid);
        const businessId = userRecord.customClaims?.business;

        // Retrieve Firestore document for the business
        const businessDoc = await admin.firestore().collection(BUSINESS_COLLECTION).doc(businessId).get();
        const businessData = businessDoc.data();
        if (!businessData) {
            throw new HttpsError('not-found', 'Business data not found.');
        }

        let customerId = businessData.stripeCustomerId;

        // Create a Stripe customer if one doesn't exist
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: businessData.email || userRecord.email,
                metadata: { firebaseUID: businessId },
            });
            customerId = customer.id;

            // Update Firestore with the new Stripe Customer ID
            await businessDoc.ref.update({ stripeCustomerId: customerId });
        }

        // Convert the token to a PaymentMethod
        const paymentMethod = await stripe.paymentMethods.create({
            type: 'card',
            card: { token }, // Use the token here to create the PaymentMethod
        });

        // Attach the PaymentMethod to the customer
        await stripe.paymentMethods.attach(paymentMethod.id, {
            customer: customerId,
        });

        // Set the default payment method for the customer
        await stripe.customers.update(customerId, {
            invoice_settings: {
                default_payment_method: paymentMethod.id,
            },
        });

        // Create a subscription
        const subscription = await stripe.subscriptions.create({
            customer: customerId,
            items: [{ price, quantity }], // Dynamically set price and quantity
            payment_behavior: 'allow_incomplete', // Prevent activation without payment
            expand: ['latest_invoice.payment_intent'],
        });

        // Get the payment intent from the subscription's latest invoice
        let paymentIntentId;
        if (isInvoice(subscription.latest_invoice)) {
            paymentIntentId = subscription.latest_invoice.payment_intent;

            if (isPaymentIntent(paymentIntentId)) {
                // If the payment intent is in a valid state, confirm it
                if (
                    paymentIntentId.status === 'requires_action' ||
                    paymentIntentId.status === 'requires_confirmation'
                ) {
                    await stripe.paymentIntents.confirm(paymentIntentId.id);
                }
            } else if (typeof paymentIntentId === 'string') {
                // Handle string-based paymentIntent ID (older API response formats)
                await stripe.paymentIntents.confirm(paymentIntentId);
            }
        } else {
            paymentIntentId = subscription.latest_invoice;
            if (paymentIntentId && typeof paymentIntentId === 'string') {
                await stripe.paymentIntents.confirm(paymentIntentId);
            }
        }

        // Store subscription details in Firestore
        await businessDoc.ref.update({
            subscriptionId: subscription.id,
            tier,
            sellerLicenses: quantity,
            subscriptionStatus: subscription.status, // Store the subscription status
        });

        logger.info(`Subscription successfully created for business: ${businessId}`);
        return { success: true, subscriptionId: subscription.id };
    } catch (error) {
        logger.error('Error creating subscription:', error.message);

        // Return a meaningful error message
        throw new HttpsError('unknown', error.message, error);
    }
});

export const CancelSubscription = onCall(async (request: CallableRequest) => {
    // Ensure the user is authenticated

    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to create a subscription.');
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
    const userRecord = await admin.auth().getUser(request.auth.uid);
    const businessId = userRecord.customClaims?.business;

    const businessDoc = admin.firestore().collection(BUSINESS_COLLECTION).doc(businessId);

    try {
        // Fetch user details from Firestore
        const userDoc = await businessDoc.get();
        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'User does not exist in the database.');
        }

        const { subscriptionId } = userDoc.data() as IBusiness;
        if (!subscriptionId) {
            throw new HttpsError('failed-precondition', 'No subscription found for this user.');
        }

        // Cancel the subscription in Stripe
        await stripe.subscriptions.cancel(subscriptionId);

        // Update Firestore to reflect cancellation
        await businessDoc.update({
            subscriptionId: null,
            subscriptionStatus: 'canceled',
        });

        logger.info(`Subscription for the company: ${businessId} was cancelled`);
        return { success: true, message: 'Subscription canceled successfully.' };
    } catch (error) {
        logger.error('Error canceling subscription:', error.message);
        throw new HttpsError('internal', error.message);
    }
});

export const FetchStripeProducts = onCall(async (request: CallableRequest) => {
    try {
        if (!request.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'User must be authenticated to create a subscription.',
            );
        }
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

        // Fetch all products from Stripe
        const products = await stripe.products.list();

        // Fetch all prices from Stripe
        const prices = await stripe.prices.list();

        // Filter products by metadata key `category` and value `mseller-subscription`
        const filteredProducts = products.data
            .filter((product) => product.metadata.category === 'mseller-subscription')
            .map((product) => {
                // Filter prices associated with the current product
                const associatedPrices = prices.data.filter((price) => price.product === product.id);

                return {
                    id: product.id,
                    name: product.name,
                    description: product.description,
                    images: product.images,
                    metadata: product.metadata,
                    prices: associatedPrices,
                };
            });

        // Return filtered products with prices
        return { success: true, data: filteredProducts };
    } catch (error) {
        console.error('Error fetching filtered products and prices:', error.message);
        throw new HttpsError('internal', error.message);
    }
});

export const GetCustomerPaymentsHistory = onCall(async (request) => {
    // Validate authentication
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to fetch payments.');
    }

    // Initialize Stripe and Firebase admin
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

    try {
        // Fetch Firebase Auth user and custom claims
        const userRecord = await admin.auth().getUser(request.auth.uid);
        const businessId = userRecord.customClaims?.business;

        if (!businessId) {
            throw new HttpsError('failed-precondition', 'No business associated with this user.');
        }

        // Retrieve Firestore document for the business
        const businessDoc = await admin.firestore().collection(BUSINESS_COLLECTION).doc(businessId).get();
        const businessData = businessDoc.data();

        if (!businessData) {
            throw new HttpsError('not-found', 'Business data not found.');
        }

        const customerId = businessData.stripeCustomerId;
        if (!customerId) {
            throw new HttpsError('not-found', 'Stripe customer ID not found for this business.');
        }

        // Fetch charges directly instead of payment intents
        const charges = await stripe.charges.list({
            customer: customerId,
            limit: 100, // Increased limit for more comprehensive results
            expand: ['data.invoice'], // Optional: expand to get more invoice details if needed
        });

        // Map the charges to a simplified structure
        const formattedCharges = charges.data.map((charge) => {
            // Safely handle invoice data
            const invoiceData =
                charge.invoice && typeof charge.invoice !== 'string'
                    ? {
                          id: charge.invoice.id,
                          number: charge.invoice.number,
                          paid: charge.invoice.paid,
                          total: charge.invoice.total / 100,
                          amount_due: charge.invoice.amount_due / 100,
                          date: charge.invoice.created,
                          status: charge.invoice.status,
                          amount_remaining: charge.invoice.amount_remaining / 100,
                          due_date: charge.invoice.due_date,
                      }
                    : null;

            return {
                id: charge.id,
                amount: charge.amount / 100, // Amount in smallest currency unit (cents)
                amount_formatted: (charge.amount / 100).toLocaleString('en-US', {
                    style: 'currency',
                    currency: charge.currency.toUpperCase(),
                }),
                date: charge.created,
                currency: charge.currency,
                status: charge.status,
                created: charge.created,
                refunded: charge.refunded,
                description: charge.description || 'No description',
                receipt_url: charge.receipt_url,
                balance_transaction: charge.balance_transaction,

                invoice: invoiceData,
                payment_method: {
                    brand: charge.payment_method_details?.card?.brand,
                    last4: charge.payment_method_details?.card?.last4,
                },
            };
        });

        // Sort charges by creation date (most recent first)
        formattedCharges.sort((a, b) => b.created - a.created);

        return {
            success: true,
            charges: formattedCharges,
            total_charges: formattedCharges.length,
        };
    } catch (error) {
        console.error('Error fetching charges:', error);

        // More detailed error handling
        if (error instanceof Stripe.errors.StripeError) {
            throw new HttpsError('internal', `Stripe Error: ${error.message}`);
        }

        throw new HttpsError('unknown', error.message || 'An unknown error occurred');
    }
});

export const GetCustomerPaymentMethods = onCall(async (request) => {
    // Validate authentication
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to fetch payment methods.');
    }

    // Initialize Stripe and Firebase admin
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

    try {
        // Fetch Firebase Auth user and custom claims
        const userRecord = await admin.auth().getUser(request.auth.uid);
        const businessId = userRecord.customClaims?.business;

        if (!businessId) {
            throw new HttpsError('failed-precondition', 'No business associated with this user.');
        }

        // Retrieve Firestore document for the business
        const businessDoc = await admin.firestore().collection(BUSINESS_COLLECTION).doc(businessId).get();
        const businessData = businessDoc.data();

        if (!businessData) {
            throw new HttpsError('not-found', 'Business data not found.');
        }

        const customerId = businessData.stripeCustomerId;
        if (!customerId) {
            throw new HttpsError('not-found', 'Stripe customer ID not found for this business.');
        }

        const customer = await stripe.customers.retrieve(customerId, {
            expand: ['invoice_settings.default_payment_method'],
        });

        // Ensure customer is not deleted and is a valid customer object
        if (typeof customer === 'string' || customer.deleted) {
            return [];
        }

        // Retrieve payment methods
        const paymentMethods = await stripe.paymentMethods.list({
            customer: customerId,
            type: 'card', // Specify card type, can be changed if needed
            limit: 100, // Adjust limit as necessary
        });

        const defaultPaymentMethodId = customer?.invoice_settings?.default_payment_method
            ? (customer.invoice_settings.default_payment_method as Stripe.PaymentMethod).id
            : null;

        // Format payment methods for response
        const formattedPaymentMethods = paymentMethods.data.map((method) => ({
            id: method.id,
            type: method.type,
            brand: method.card?.brand,
            last4: method.card?.last4,
            exp_month: method.card?.exp_month,
            exp_year: method.card?.exp_year,
            funding: method.card?.funding,
            country: method.card?.country,
            wallet: method.card?.wallet, // For digital wallets
            created: method.created,
            billing_details: {
                name: method.billing_details?.name,
                email: method.billing_details?.email,
                phone: method.billing_details?.phone,
            },
            is_default: method.id === defaultPaymentMethodId,
            card_display: method.card
                ? `${method.card.brand?.toUpperCase()} •••• ${method.card.last4}`
                : 'Unknown Card',
        }));

        return {
            success: true,
            payment_methods: formattedPaymentMethods,
            total_methods: formattedPaymentMethods.length,
        };
    } catch (error) {
        console.error('Error fetching payment methods:', error);

        // Detailed error handling
        if (error instanceof Stripe.errors.StripeError) {
            throw new HttpsError('internal', `Stripe Error: ${error.message}`);
        }

        throw new HttpsError('unknown', error.message || 'An unknown error occurred');
    }
});

interface UpdateCardRequest {
    cardNumber: string;
    name: string;
    expirationDate: string; // Format MM/YY
    status: string; // e.g., "active" or "inactive"
    cvc: string;
    isDefault: boolean;
}

export const UpdateCustomerCard = onCall(async (request: CallableRequest<UpdateCardRequest>) => {
    // Validate authentication
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to fetch payment methods.');
    }

    // Initialize Stripe and Firebase admin
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

    try {
        const { cardNumber, name, expirationDate, cvc, isDefault } = request.data;

        // Validate the expirationDate format (MM/YY)
        if (!/^\d{2}\/\d{2}$/.test(expirationDate)) {
            throw new HttpsError('invalid-argument', 'Expiration date must be in MM/YY format.');
        }

        const [expMonth, expYear] = expirationDate.split('/').map(Number);

        // Retrieve the Stripe Customer ID (assumes you store it in Firestore)
        const userRecord = await admin.auth().getUser(request.auth.uid);
        const businessId = userRecord.customClaims?.business;

        const businessDoc = await admin.firestore().collection(BUSINESS_COLLECTION).doc(businessId).get();

        const businessData = businessDoc.data();
        if (!businessData || !businessData.stripeCustomerId) {
            throw new functions.https.HttpsError('not-found', 'Stripe Customer ID not found for the business.');
        }

        const stripeCustomerId = businessData.stripeCustomerId;

        // Update the card in Stripe
        const updatedCard = await stripe.paymentMethods.create({
            type: 'card',
            card: {
                number: cardNumber,
                exp_month: expMonth,
                exp_year: expYear,
                cvc,
            },
            billing_details: {
                name,
            },
        });

        // If `isDefault` is true, set this card as the default payment method
        if (isDefault) {
            await stripe.customers.update(stripeCustomerId, {
                invoice_settings: {
                    default_payment_method: updatedCard.id,
                },
            });
            console.log(`Card ${updatedCard.id} set as default for business ${businessId}`);
        }

        // Return success response
        return { success: true, message: 'Card updated successfully.' };
    } catch (error) {
        console.error('Error updating card:', error);
        throw new functions.https.HttpsError('internal', 'Unable to update card details.');
    }
});

export const RemoveCustomerCard = onCall(async (request: CallableRequest<{ cardId: string }>) => {
    // Initialize Stripe and Firebase admin
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

    // Validate authentication
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to remove payment methods.');
    }

    try {
        const { cardId } = request.data;

        if (!cardId) {
            throw new HttpsError('invalid-argument', 'Card ID is required.');
        }

        // Retrieve the Stripe Customer ID (assumes it's stored in Firestore)
        const userRecord = await admin.auth().getUser(request.auth.uid);
        const businessId = userRecord.customClaims?.business;

        const businessDoc = await admin.firestore().collection(BUSINESS_COLLECTION).doc(businessId).get();
        const businessData = businessDoc.data();

        if (!businessData || !businessData.stripeCustomerId) {
            throw new HttpsError('not-found', 'Stripe Customer ID not found for the business.');
        }

        // const stripeCustomerId = businessData.stripeCustomerId;

        // Detach the card from the Stripe customer
        const detachedPaymentMethod = await stripe.paymentMethods.detach(cardId);

        if (detachedPaymentMethod.customer !== null) {
            throw new HttpsError(
                'failed-precondition',
                'Failed to remove the card. It may still be associated with the customer.',
            );
        }

        console.log(`Card ${cardId} removed successfully for business ${businessId}`);

        // Return success response
        return { success: true, message: 'Card removed successfully.' };
    } catch (error) {
        console.error('Error removing card:', error);
        throw new HttpsError('internal', 'Unable to remove card.');
    }
});
