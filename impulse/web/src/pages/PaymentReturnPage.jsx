import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getBillingOrderStatus } from '@/lib/portalServer';
import { formatPriceInr } from '@/lib/premiumCatalog';

const POLL_INTERVAL_MS = 5000;
const MAX_AUTOMATIC_CHECKS = 12;

function PaymentReturnPage() {
  const location = useLocation();
  const orderId = new URLSearchParams(location.search).get('order_id') || '';
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const checkStatus = useCallback(async () => {
    if (!/^[A-Za-z0-9_-]{10,64}$/.test(orderId)) {
      setError('The payment return link does not contain a valid order reference.');
      setIsLoading(false);
      return null;
    }

    setError('');
    try {
      const currentOrder = await getBillingOrderStatus(orderId);
      setOrder(currentOrder);
      return currentOrder;
    } catch (statusError) {
      console.error('Could not confirm the returned payment.', statusError);
      setError(statusError.message || 'Payment status could not be checked.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    let active = true;
    let timeout;
    let checks = 0;
    setIsLoading(true);
    setOrder(null);
    setError('');

    const poll = async () => {
      const currentOrder = await checkStatus();
      if (!active || currentOrder?.status !== 'pending' || checks >= MAX_AUTOMATIC_CHECKS) return;
      checks += 1;
      timeout = window.setTimeout(poll, POLL_INTERVAL_MS);
    };
    poll();

    return () => {
      active = false;
      if (timeout) window.clearTimeout(timeout);
    };
  }, [checkStatus, refreshKey]);

  const isPending = order?.status === 'pending';
  const isSuccess = order?.status === 'succeeded';
  const isFailed = order?.status === 'failed' || order?.status === 'expired';
  const returnPath = order?.productType === 'test_series' ? '/test-series' : '/premium';

  return (
    <>
      <Helmet>
        <title>Payment status - Impulse</title>
      </Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 px-4 py-12">
          <Card className="mx-auto max-w-xl">
            <CardHeader>
              <CardTitle className="text-2xl font-black">Payment status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? <p role="status">Checking your payment with the gateway…</p> : null}
              {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
              {isSuccess ? (
                <div role="status" className="space-y-2">
                  <p className="font-bold text-primary">Payment verified successfully.</p>
                  <p className="text-sm text-muted-foreground">
                    {order.productType === 'subscription'
                      ? 'Your subscription has been activated.'
                      : 'Your test-series purchase is ready.'}
                  </p>
                </div>
              ) : null}
              {isPending ? (
                <p role="status" className="text-sm">
                  Payment is still pending. Access is granted only after the gateway confirms it.
                </p>
              ) : null}
              {isFailed ? (
                <p role="status" className="text-sm text-destructive">
                  This payment was not completed. No subscription or test-series access was granted.
                </p>
              ) : null}
              {order ? (
                <dl className="grid grid-cols-2 gap-2 border-t border-border pt-3 text-sm">
                  <dt className="text-muted-foreground">Order</dt>
                  <dd className="break-all text-right font-mono">{order.orderId}</dd>
                  <dt className="text-muted-foreground">Amount</dt>
                  <dd className="text-right font-bold">{formatPriceInr(order.amountInr)}</dd>
                </dl>
              ) : null}
              {error || (isPending && !isLoading) ? (
                <Button type="button" variant="outline" onClick={() => setRefreshKey((key) => key + 1)}>
                  Check again
                </Button>
              ) : null}
              <Button asChild variant={isSuccess || isFailed ? 'default' : 'outline'}>
                <Link to={returnPath}>{order?.productType === 'test_series' ? 'Open test series' : 'Return to plans'}</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    </>
  );
}

export default PaymentReturnPage;
