import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

function StatsCard({ label, value, icon: Icon, trend }) {
  return (
    <Card className="border-border">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-2">
              {label}
            </p>
            <p className="text-4xl font-black tracking-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {value}
            </p>
            {trend && (
              <p className="text-sm text-muted-foreground mt-2">{trend}</p>
            )}
          </div>
          {Icon && (
            <div className="p-3 bg-secondary rounded-sm">
              <Icon className="h-6 w-6" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default StatsCard;