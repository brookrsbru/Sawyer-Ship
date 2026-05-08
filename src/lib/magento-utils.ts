import { MagentoOrder } from './api-clients';

/**
 * Robustly normalizes a raw Magento order response into a consistent MagentoOrder object.
 * This should be used on the frontend after fetching raw data via the server proxy.
 */
export function normalizeMagentoOrder(order: any): MagentoOrder {
  if (!order) return order;

  // We try multiple paths to find the most populated address object
  let shippingAddress = null;

  // 1. Standard Extension Attributes Path (Most common for M2)
  if (order.extension_attributes?.shipping_assignments?.[0]?.shipping?.address) {
    shippingAddress = order.extension_attributes.shipping_assignments[0].shipping.address;
  }
  // 2. Direct Extension Attribute Path
  else if (order.extension_attributes?.shipping_address) {
    shippingAddress = order.extension_attributes.shipping_address;
  }
  // 3. Root Level Shipping Address (Sometimes present but partial)
  else if (order.shipping_address && (order.shipping_address.street || order.shipping_address.city || order.shipping_address.postcode)) {
    shippingAddress = order.shipping_address;
  }
  // 4. Billing Address Fallback (Better than empty if shipping is missing)
  else if (order.billing_address && (order.billing_address.street || order.billing_address.city)) {
    shippingAddress = order.billing_address;
  }

  // Defensive fallback: If shippingAddress is still null or missing street/city,
  // scan order for anything that looks like an address object
  if (!shippingAddress || (!shippingAddress.street && !shippingAddress.city)) {
    // Deep search for address-like object in extension_attributes
    if (order.extension_attributes) {
      for (const key in order.extension_attributes) {
        const obj = order.extension_attributes[key];
        if (obj && typeof obj === 'object' && (obj.street || obj.postcode) && obj.city) {
          shippingAddress = obj;
          break;
        }
      }
    }
  }

  // Final safety: if STILL null, use a blank object to prevent crashes
  if (!shippingAddress) shippingAddress = {};

  // Ensure street is an array (Magento can return string, array, or even a line-indexed object)
  let street: string[] = [];
  if (Array.isArray(shippingAddress.street)) {
    street = shippingAddress.street;
  } else if (typeof shippingAddress.street === 'string') {
    street = [shippingAddress.street];
  } else if (shippingAddress.street && typeof shippingAddress.street === 'object') {
    // Handle cases where street is { "0": "line1", "1": "line2" }
    street = Object.values(shippingAddress.street) as string[];
  }

  // Build the shipping_address object the frontend expects
  const normalizedShippingAddress = {
    firstname: shippingAddress.firstname || order.customer_firstname || '',
    lastname: shippingAddress.lastname || order.customer_lastname || '',
    company: shippingAddress.company || '',
    street: street.filter(s => typeof s === 'string'),
    city: shippingAddress.city || '',
    region: shippingAddress.region || '',
    postcode: shippingAddress.postcode || '',
    country_id: shippingAddress.country_id || '',
    telephone: shippingAddress.telephone || '',
    is_residential: !!shippingAddress.is_residential
  };

  return {
    ...order,
    // Ensure top-level customer names are populated correctly
    customer_firstname: normalizedShippingAddress.firstname || order.customer_firstname || '',
    customer_lastname: normalizedShippingAddress.lastname || order.customer_lastname || '',
    shipping_address: normalizedShippingAddress
  };
}
