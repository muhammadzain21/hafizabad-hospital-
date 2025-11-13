import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export const ReceptionPortal: React.FC = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reception Portal</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-gray-500">
            Welcome to the reception portal. This area is restricted to reception staff only.
          </p>
          <div>
            <Link to="/reception/cart">
              <Button>Open Reception Cart</Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReceptionPortal;
