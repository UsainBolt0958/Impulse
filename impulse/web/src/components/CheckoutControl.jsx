import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createBillingOrder } from '@/lib/portalServer';
import { formatPriceInr } from '@/lib/premiumCatalog';

function CheckoutControl({ productType, planCode, durationMonths, seriesId, priceInr, className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mobile, setMobile] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!/^[6-9]\d{9}$/.test(mobile.trim())) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const order = await createBillingOrder({
        productType,
        planCode,
        durationMonths,
        seriesId,
        mobile: mobile.trim(),
      });
      window.location.assign(order.paymentUrl);
    } catch (checkoutError) {
      console.error('Could not start UPI checkout.', checkoutError);
      setError(checkoutError.message || 'Checkout could not be started. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className={className}>
      {!isOpen ? (
        <Button type="button" className="w-full" onClick={() => setIsOpen(true)}>
          Buy · {formatPriceInr(priceInr)}
        </Button>
      ) : (
        <form className="space-y-2" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor={`checkout-mobile-${productType}-${planCode || seriesId}-${durationMonths || ''}`}>
            Mobile number for UPI payment
          </label>
          <input
            id={`checkout-mobile-${productType}-${planCode || seriesId}-${durationMonths || ''}`}
            autoComplete="tel-national"
            inputMode="numeric"
            maxLength={10}
            pattern="[6-9][0-9]{9}"
            required
            value={mobile}
            onChange={(event) => setMobile(event.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="10-digit mobile number"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
          {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? 'Opening payment…' : `Continue · ${formatPriceInr(priceInr)}`}
            </Button>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

export default CheckoutControl;
